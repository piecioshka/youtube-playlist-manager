import { z } from 'zod';

const thumbnailSchema = z.object({ url: z.string() });

export const playlistResourceSchema = z.object({
  id: z.string(),
  snippet: z.object({
    title: z.string(),
    description: z.string().default(''),
    defaultLanguage: z.string().optional(),
    publishedAt: z.string(),
    thumbnails: z
      .object({
        default: thumbnailSchema.optional(),
        medium: thumbnailSchema.optional(),
        high: thumbnailSchema.optional(),
      })
      .optional(),
  }),
  contentDetails: z.object({ itemCount: z.number() }).optional(),
  status: z
    .object({ privacyStatus: z.enum(['public', 'unlisted', 'private']) })
    .optional(),
});

export type PlaylistResource = z.infer<typeof playlistResourceSchema>;

export const playlistListResponseSchema = z.object({
  items: z.array(playlistResourceSchema).default([]),
  nextPageToken: z.string().optional(),
});

// Usunięte i prywatne filmy wracają bez `videoOwnerChannelTitle`, czasem także bez `videoId`
export const playlistItemListResponseSchema = z.object({
  items: z
    .array(
      z.object({
        snippet: z.object({
          title: z.string(),
          videoOwnerChannelTitle: z.string().optional(),
          resourceId: z.object({ videoId: z.string().optional() }),
        }),
      }),
    )
    .default([]),
  nextPageToken: z.string().optional(),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    message: z.string().default(''),
    errors: z.array(z.object({ reason: z.string() })).default([]),
  }),
});
