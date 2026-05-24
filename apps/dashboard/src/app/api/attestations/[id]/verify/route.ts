import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { verifyAttestationRecord, type AttestationRecord } from '@/lib/attestations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ATTESTATION_ID_RE = /^att_[A-Za-z0-9_-]+$/;

// Intentionally public: an attestation link is the distribution primitive.
// Anyone who receives one — an auditor, a partner agent, a journalist — must
// be able to verify it without holding a MandateZ API key. The payload only
// exposes data already bound to the platform-signed attestation, so making
// it public reveals nothing the holder of the link didn't already have.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id || !ATTESTATION_ID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid attestation id' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('attestations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Attestation not found' }, { status: 404 });
  }

  const record = data as AttestationRecord;
  const valid = await verifyAttestationRecord(record);

  return NextResponse.json({
    valid,
    attestation: record,
    verified_at: new Date().toISOString(),
  });
}
