"use client";

import { useEffect } from "react";

export default function DashboardPage() {
  useEffect(() => {
    // Redirect to the static HTML file
    window.location.href = "/dashboard.html";
  }, []);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <p>Redirecting to dashboard...</p>
    </div>
  );
}
