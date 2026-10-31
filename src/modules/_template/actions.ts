"use server";

import { requireAuth } from "@/modules/auth/auth-utils";
import { apiSuccess, apiError, ApiResponse, ERROR_CODES } from "@/lib/api-response";
import { createSampleSchema, CreateSampleInput } from "./validations";
import { SampleItem } from "./types";

/**
 * Template Server Action demonstrating authorization, validation, and standard ApiResponse
 */
export async function createSampleAction(input: CreateSampleInput): Promise<ApiResponse<SampleItem>> {
  try {
    // 1. Authorize caller
    await requireAuth();

    // 2. Validate external input
    const validation = createSampleSchema.safeParse(input);
    if (!validation.success) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Input validation failed",
        validation.error.flatten().fieldErrors
      );
    }

    // 3. Database operations go here:
    // const supabase = await createClient();
    // const { data, error } = await supabase.from('...').insert(...)

    const item: SampleItem = {
      id: crypto.randomUUID(),
      name: validation.data.name,
      status: "active",
      amount: validation.data.amount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 4. Return standard API response
    return apiSuccess(item);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server failure";
    return apiError(ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}
