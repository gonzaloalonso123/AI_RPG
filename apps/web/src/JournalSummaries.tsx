import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Locale } from "@story/contracts";
export function JournalSummaries({
  campaignId,
  locale,
}: {
  campaignId: string;
  locale: Locale;
}) {
  const [summaries, setSummaries] = useState<
    { id: string; text: string; sourceIds: string[] }[]
  >([]);
  useEffect(
    () =>
      onSnapshot(
        query(
          collection(db, "campaigns", campaignId, "summaries"),
          orderBy("version", "desc"),
          limit(5),
        ),
        (snap) =>
          setSummaries(
            snap.docs.map(
              (d) =>
                ({ id: d.id, ...d.data() }) as {
                  id: string;
                  text: string;
                  sourceIds: string[];
                },
            ),
          ),
      ),
    [campaignId],
  );
  if (!summaries.length) return null;
  return (
    <section>
      <h3>{locale === "es" ? "Resúmenes de sesión" : "Session recaps"}</h3>
      {summaries.map((s) => (
        <article className="journal-event" key={s.id}>
          <p>{s.text}</p>
          <details>
            <summary>
              {locale === "es" ? "Sucesos originales" : "Original events"}
            </summary>
            {s.sourceIds.join(" · ")}
          </details>
        </article>
      ))}
    </section>
  );
}
