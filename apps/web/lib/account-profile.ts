"use client";

import { useEffect, useSyncExternalStore } from "react";
import { applyChanges, diffProfile, emptyProfile, parseProfile, type EntryChange, type JobProfile } from "./account-model";

type State = {
  mode: "loading" | "device" | "account";
  ready: boolean;
  profile: JobProfile;
  error: string | null;
  loginAvailable: boolean;
  name: string | null;
};

const DEVICE_KEY = "job-atlas:device-profile:v1";
const initial: State = { mode: "loading", ready: false, profile: emptyProfile(), error: null, loginAvailable: false, name: null };
let state = initial;
let confirmed = emptyProfile();
let owner: string | null = null;
let loading = false;
let pending: EntryChange[][] = [];
let writing = false;
const listeners = new Set<() => void>();
const subscribe = (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; };

function publish(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const notify of listeners) notify();
}

function deviceProfile() {
  const value = localStorage.getItem(DEVICE_KEY);
  return value ? parseProfile(JSON.parse(value)) ?? emptyProfile() : emptyProfile();
}

async function load() {
  if (loading || writing) return;
  loading = true;
  // Disable edits during identity refresh (e.g. after another tab signed out).
  publish({ ready: false });
  try {
    const response = await fetch("/api/profile", { cache: "no-store" });
    if (!response.ok) throw new Error("設定暫時無法載入。");
    const data = await response.json();
    if (data.status === "authenticated") {
      const profile = parseProfile(data.profile);
      if (!profile || typeof data.user?.id !== "string") throw new Error("帳號設定格式無法辨識。");
      owner = data.user.id;
      confirmed = profile;
      publish({ mode: "account", ready: true, profile, name: data.user.name, loginAvailable: true, error: null });
    } else if (data.status === "anonymous" || data.status === "unavailable") {
      owner = null;
      confirmed = deviceProfile();
      publish({ mode: "device", ready: true, profile: confirmed, name: null, loginAvailable: data.status === "anonymous", error: null });
    } else {
      throw new Error("帳號狀態無法辨識。");
    }
  } catch {
    owner = null;
    confirmed = emptyProfile();
    publish({ ...initial, error: "目前無法讀取設定，請重新整理後再試。" });
  } finally {
    loading = false;
  }
}

async function flush() {
  if (writing) return;
  writing = true;
  let refreshIdentity = false;
  while (pending.length > 0) {
    const changes = pending[0];
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, changes }),
      });
      if (response.status === 401 || response.status === 409) {
        pending = [];
        refreshIdentity = true;
        break;
      }
      if (!response.ok) throw new Error();
      const profile = parseProfile((await response.json()).profile);
      if (!profile) throw new Error();
      confirmed = profile;
    } catch {
      publish({ error: "有一筆變更尚未儲存，請重新操作。" });
    }
    pending.shift();
    publish({ profile: pending.reduce(applyChanges, confirmed) });
  }
  writing = false;
  if (refreshIdentity) await load();
}

function updateProfile(patch: Partial<JobProfile>) {
  if (!state.ready) return;
  const changes = diffProfile(state.profile, patch);
  if (changes.length === 0) return;
  if (state.mode === "device") {
    try {
      const next = applyChanges(deviceProfile(), changes);
      localStorage.setItem(DEVICE_KEY, JSON.stringify(next));
      publish({ profile: next, error: null });
    } catch {
      publish({ error: "瀏覽器無法儲存這次變更。" });
    }
    return;
  }
  pending.push(changes);
  publish({ profile: applyChanges(state.profile, changes), error: null });
  void flush();
}

export function useAccountProfile() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => initial);
  useEffect(() => {
    void load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === DEVICE_KEY && state.mode === "device") void load();
    };
    window.addEventListener("focus", load);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", load);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return { ...snapshot, updateProfile };
}
