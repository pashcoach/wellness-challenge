"use client";

import { useEffect, useState } from "react";
import { isLoggingClosed, LOGGING_CLOSE_AT } from "./logging-close";

/** Update mounted tabs at the cutoff, and recheck when a sleeping tab resumes. */
export function useLoggingClosed(): boolean {
  const [closed, setClosed] = useState(isLoggingClosed);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const isClosed = isLoggingClosed();
      setClosed(isClosed);
      if (!isClosed) {
        timer = setTimeout(update, Math.min(Date.parse(LOGGING_CLOSE_AT) - Date.now(), 2_147_483_647));
      }
    };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return closed;
}
