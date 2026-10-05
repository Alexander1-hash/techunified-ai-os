import { createClient } from "@/lib/supabase/client";
import type { KnowledgeDocument } from "@/lib/brain/types";

function inferMimeType(file: File) {
  const reportedType = file.type?.trim().toLowerCase();

  if (reportedType && reportedType !== "application/octet-stream") {
    return reportedType;
  }

  const extension = file.name
    .split(".")
    .pop()
    ?.trim()
    .toLowerCase();

  const types: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    csv: "text/csv",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  return types[extension ?? ""] ?? reportedType ?? "application/octet-stream";
}

async function getCurrentOrganizationId(
  supabase: ReturnType<typeof createClient>,
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(
      "Your session has expired. Please sign in again.",
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Unable to resolve your organization: ${profileError.message}`,
    );
  }

  if (!profile?.organization_id) {
    throw new Error(
      "Your account is not connected to an organization yet.",
    );
  }

  return {
    userId: user.id,
    organizationId: profile.organization_id,
  };
}

export async function listKnowledgeDocuments(): Promise<{
  data: KnowledgeDocument[];
  error: Error | null;
}> {
  const supabase = createClient();

  try {
    const { organizationId } =
      await getCurrentOrganizationId(supabase);

    const { data, error } = await supabase
      .from("knowledge_documents")
      .select(
        "id,name,file_type,storage_path,department_id,status,metadata,uploaded_by,created_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      return {
        data: [],
        error: new Error(
          `Unable to load knowledge sources: ${error.message}`,
        ),
      };
    }

    return {
      data: (data ?? []) as KnowledgeDocument[],
      error: null,
    };
  } catch (error) {
    return {
      data: [],
      error:
        error instanceof Error
          ? error
          : new Error(
              "Unable to load knowledge sources.",
            ),
    };
  }
}

export async function uploadKnowledgeDocument(
  file: File,
  userId: string,
  organizationId: string | null,
) {
  const supabase = createClient();

  const {
    userId: authenticatedUserId,
    organizationId: resolvedOrganizationId,
  } = await getCurrentOrganizationId(supabase);

  if (authenticatedUserId !== userId) {
    throw new Error(
      "The authenticated user does not match the upload owner.",
    );
  }

  const finalOrganizationId =
    organizationId ?? resolvedOrganizationId;

  if (finalOrganizationId !== resolvedOrganizationId) {
    throw new Error(
      "The selected organization does not match your account.",
    );
  }

  if (!(file instanceof File)) {
    throw new Error("Please select a valid file.");
  }

  if (file.size <= 0) {
    throw new Error("The selected file is empty.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Knowledge documents must be 10 MB or smaller.");
  }

  const safeName =
    file.name
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-") || "document";

  const fileType = inferMimeType(file);

  const path =
    `${finalOrganizationId}/` +
    `${crypto.randomUUID()}-${safeName}`;

  const upload = await supabase.storage
    .from("company-knowledge")
    .upload(path, file, {
      contentType: fileType,
      upsert: false,
    });

  if (upload.error) {
    throw new Error(
      `Knowledge document upload failed: ${upload.error.message}`,
    );
  }

  const record = await supabase
    .from("knowledge_documents")
    .insert({
      name: file.name,
      file_type: fileType,
      storage_path: path,
      status: "Processing",
      metadata: {
        size: file.size,
        original_name: file.name,
        reported_mime_type: file.type || null,
      },
      uploaded_by: authenticatedUserId,
      organization_id: finalOrganizationId,
    })
    .select(
      "id,name,file_type,storage_path,department_id,status,metadata,uploaded_by,created_at",
    )
    .single();

  if (record.error) {
    const cleanup = await supabase.storage
      .from("company-knowledge")
      .remove([path]);

    if (cleanup.error) {
      console.error(
        "[Company Brain] Storage cleanup failed:",
        cleanup.error,
      );
    }

    throw new Error(
      `Knowledge document record could not be created: ${record.error.message}`,
    );
  }

  if (!record.data) {
    throw new Error(
      "Knowledge document was uploaded but no database record was returned.",
    );
  }

  return record.data as KnowledgeDocument;
}
