#!/usr/bin/env bash
set -euo pipefail
: "${GCLOUD_PROJECT:?Set the staging Firebase project ID}"
gcloud firestore indexes composite create --project="$GCLOUD_PROJECT" --collection-group=memories --query-scope=COLLECTION --field-config=field-path=visibility,order=ASCENDING --field-config='field-path=embedding,vector-config={"dimension":"1536","flat":"{}"}'
