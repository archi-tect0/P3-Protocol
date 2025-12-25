import { z } from "zod";

export const PolicyConfig = z.object({
  id: z.string(),
  type: z.enum(["multisig","timelock","quadratic","roleweighted"]),
  params: z.any(),
  roles: z.array(z.string()).optional()
});

export type PolicyConfig = z.infer<typeof PolicyConfig>;
