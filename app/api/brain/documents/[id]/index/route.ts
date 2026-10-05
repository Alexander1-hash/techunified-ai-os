import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { createClient } from "@/lib/supabase/server";
import { chunkDocument } from "@/lib/brain/processing";

const MAX_CHUNK_SIZE = 1200;
const MAX_CHUNK_OVERLAP = 120;
const MAX_INDEXABLE_CHARS = 250000;

function extractDelimitedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

async function extractTextFromBlob(blob: Blob, fileName: string, fileType: string) {
  const lowerName = fileName.toLowerCase();

  if (
    fileType === "text/plain" ||
    fileType === "text/csv" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv")
  ) {
    return extractDelimitedText(await blob.text());
  }

  if (
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    fileType.includes("spreadsheet") ||
    fileType.includes("excel")
  ) {
    const buffer = await blob.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      return `[Sheet: ${sheetName}]\n${csv}`;
    })
      .join("\n\n")
      .trim();
  }

  throw new Error(
    "This document type is not indexable yet. Company Brain currently indexes TXT, CSV, XLS, and XLSX files.",
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "Document id is required." }, { status: 400 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Please sign in to index Company Brain knowledge." },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.organization_id) {
    return NextResponse.json(
      { error: "Unable to resolve your organization." },
      { status: 400 },
    );
  }

  const organizationId = profile.organization_id;

  const { data: document, error: documentError } = await supabase
    .from("knowledge_documents")
    .select("id,name,file_type,storage_path,metadata,status")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (documentError || !document) {
    return NextResponse.json(
      { error: "Knowledge document could not be found." },
      { status: 404 },
    );
  }

  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from("company-knowledge")
      .download(document.storage_path);

    if (downloadError || !file) {
      throw new Error(
        `The stored knowledge document could not be read: ${downloadError?.message ?? "file unavailable"}`,
      );
    }

    const text = await extractTextFromBlob(
      file,
      document.name,
      document.file_type || "",
    );

    if (!text) {
      throw new Error("The knowledge document contains no readable text.");
    }

    if (text.length > MAX_INDEXABLE_CHARS) {
      throw new Error(
        `The readable content is too large to index in one operation. Keep the document under ${MAX_INDEXABLE_CHARS.toLocaleString()} characters.`,
      );
    }

    const chunks = chunkDocument(
      text,
      MAX_CHUNK_SIZE,
      MAX_CHUNK_OVERLAP,
    ).filter((chunk) => chunk.trim());

    if (!chunks.length) {
      throw new Error("No readable knowledge chunks were produced.");
    }

    const { error: deleteError } = await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", document.id)
      .eq("organization_id", organizationId);

    if (deleteError) {
      throw new Error(
        `Existing knowledge chunks could not be refreshed: ${deleteError.message}`,
      );
    }

    const rows = chunks.map((content, chunkIndex) => ({
      document_id: document.id,
      organization_id: organizationId,
      content,
      chunk_index: chunkIndex,
      metadata: {
        source: "company-knowledge",
        characters: content.length,
      },
    }));

    const { error: insertError } = await supabase
      .from("knowledge_chunks")
      .insert(rows);

    if (insertError) {
      throw new Error(
        `Knowledge chunks could not be saved: ${insertError.message}`,
      );
    }

    const nextMetadata = {
      ...(document.metadata &&
      typeof document.metadata === "object" &&
      !Array.isArray(document.metadata)
        ? document.metadata
        : {}),
      indexed_at: new Date().toISOString(),
      indexed_characters: text.length,
      chunk_count: chunks.length,
    };

    const { error: updateError } = await supabase
      .from("knowledge_documents")
      .update({
        status: "Indexed",
        metadata: nextMetadata,
      })
      .eq("id", document.id)
      .eq("organization_id", organizationId);

    if (updateError) {
      throw new Error(
        `Knowledge document status could not be updated: ${updateError.message}`,
      );
    }

    return NextResponse.json({
      success: true,
      documentId: document.id,
      status: "Indexed",
      chunkCount: chunks.length,
      characters: text.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Company Brain could not index this document.";

    await supabase
      .from("knowledge_documents")
      .update({
        status: "Failed",
        metadata: {
          ...(document.metadata &&
          typeof document.metadata === "object" &&
          !Array.isArray(document.metadata)
            ? document.metadata
            : {}),
          indexing_error: message,
          failed_at: new Date().toISOString(),
        },
      })
      .eq("id", document.id)
      .eq("organization_id", organizationId);

    return NextResponse.json(
      { error: message },
      { status: 422 },
    );
  }
}
