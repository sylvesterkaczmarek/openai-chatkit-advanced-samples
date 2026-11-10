import { useCallback, useEffect, useRef, useState } from "react";

import { SUPPORT_CUSTOMER_URL } from "../lib/config";

export type FlightSegment = {
  flight_number: string;
  date: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  seat: string;
  status: string;
};

export type TimelineEntry = {
  timestamp: string;
  kind: string;
  entry: string;
};

export type LoyaltyProgress = {
  current_tier: string;
  next_tier: string;
  points_earned: number;
  points_required: number;
  segments_flown: number;
  segments_required: number;
  renewal_date: string;
};

export type CustomerProfile = {
  customer_id: string;
  name: string;
  loyalty_status: string;
  loyalty_id: string;
  email: string;
  phone: string;
  home_airport: string;
  preferred_routes: string[];
  travel_summary: string;
  tier_benefits: string[];
  loyalty_progress: LoyaltyProgress;
  segments: FlightSegment[];
  bags_checked: number;
  meal_preference: string | null;
  special_assistance: string | null;
  timeline: TimelineEntry[];
  spotlight: string[];
};

type CustomerResponse = {
  customer: CustomerProfile;
};

export function useCustomerContext(threadId: string | null) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestVersion = useRef(0);
  const activeThread = useRef<string | null | undefined>(undefined);

  const fetchProfile = useCallback(async () => {
    if (activeThread.current !== threadId) return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const url = threadId
        ? `${SUPPORT_CUSTOMER_URL}?thread_id=${encodeURIComponent(threadId)}`
        : SUPPORT_CUSTOMER_URL;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Failed to load customer context (${response.status})`);
      }
      const payload = (await response.json()) as CustomerResponse;
      if (version === requestVersion.current) setProfile(payload.customer);
    } catch (err) {
      if (version !== requestVersion.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setProfile(null);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    activeThread.current = threadId;
    void fetchProfile();
    return () => {
      activeThread.current = undefined;
      requestVersion.current++;
    };
  }, [fetchProfile, threadId]);

  const applyProfileUpdate = useCallback((nextProfile: CustomerProfile) => {
    // A retained callback from a different thread must not supersede its request.
    if (activeThread.current !== threadId) return;
    // A direct update supersedes any profile snapshot already being fetched.
    requestVersion.current++;
    setProfile(nextProfile);
    setLoading(false);
    setError(null);
  }, [threadId]);

  return {
    profile,
    loading,
    error,
    refresh: fetchProfile,
    setProfile: applyProfileUpdate,
  };
}
