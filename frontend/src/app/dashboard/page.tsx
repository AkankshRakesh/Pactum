"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

type User = {
  username: string;
  email: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      try {
        const response = await fetch(`${API_BASE}/api/auth/me/`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          router.replace("/auth");
          return;
        }

        const result = await response.json();
        setUser(result.user);
        setCheckingSession(false);
      } catch {
        if (!controller.signal.aborted) {
          router.replace("/auth");
        }
      }
    }

    checkSession();
    return () => controller.abort();
  }, [router]);

  async function handleLogout() {
    try {
      const csrfResponse = await fetch(`${API_BASE}/api/auth/csrf/`, {
        credentials: "include",
      });
      const { csrfToken } = await csrfResponse.json();

      await fetch(`${API_BASE}/api/auth/logout/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
      });
    } finally {
      router.replace("/");
    }
  }

  if (checkingSession || !user) {
    return (
      <main className="dashboard-shell" aria-live="polite">
        <p>Verifying party credentials...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <div>
        <p className="dashboard-kicker">Authenticated party</p>
        <h1>Dashboard</h1>
        <p className="dashboard-welcome">
          Welcome, {user.username}. Your contracts and agreements are ready.
        </p>
      </div>
      <button type="button" className="dashboard-logout" onClick={handleLogout}>
        Sign out
      </button>
    </main>
  );
}