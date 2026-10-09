import { useEffect, useState } from "react";
import { getBlob, ref } from "firebase/storage";
import { storage } from "./firebase";
export function Portrait({
  path,
  name,
}: {
  path: string | null;
  name: string;
}) {
  const [src, setSrc] = useState("/art/portrait.svg");
  useEffect(() => {
    let url: string | null = null,
      cancelled = false;
    setSrc("/art/portrait.svg");
    if (path)
      void getBlob(ref(storage, path))
        .then((blob) => {
          if (!cancelled) {
            url = URL.createObjectURL(blob);
            setSrc(url);
          }
        })
        .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return <img className="portrait" src={src} alt={name} />;
}
