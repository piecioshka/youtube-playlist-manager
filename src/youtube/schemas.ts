import { z } from 'zod';

const thumbnailSchema = z.object({ url: z.string() });

const thumbnailsSchema = z
  .object({
    default: thumbnailSchema.optional(),
    medium: thumbnailSchema.optional(),
    high: thumbnailSchema.optional(),
  })
  .optional();

export type Thumbnails = z.infer<typeof thumbnailsSchema>;

export const playlistResourceSchema = z.object({
  id: z.string(),
  snippet: z.object({
    title: z.string(),
    description: z.string().default(''),
    defaultLanguage: z.string().optional(),
    publishedAt: z.string(),
    thumbnails: thumbnailsSchema,
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
export const playlistItemResourceSchema = z.object({
  id: z.string(),
  snippet: z.object({
    title: z.string(),
    position: z.number(),
    thumbnails: thumbnailsSchema,
    videoOwnerChannelTitle: z.string().optional(),
    resourceId: z.object({ videoId: z.string().optional() }),
  }),
});

export type PlaylistItemResource = z.infer<typeof playlistItemResourceSchema>;

export const playlistItemListResponseSchema = z.object({
  items: z.array(playlistItemResourceSchema).default([]),
  nextPageToken: z.string().optional(),
});

export const channelResourceSchema = z.object({
  id: z.string(),
  snippet: z.object({
    title: z.string(),
    customUrl: z.string().optional(),
    publishedAt: z.string(),
    thumbnails: thumbnailsSchema,
  }),
  // API zwraca liczniki jako napisy
  statistics: z.object({
    viewCount: z.string(),
    videoCount: z.string(),
    subscriberCount: z.string().optional(),
    hiddenSubscriberCount: z.boolean().optional(),
  }),
});

export type ChannelResource = z.infer<typeof channelResourceSchema>;

export const channelListResponseSchema = z.object({
  items: z.array(channelResourceSchema).default([]),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    message: z.string().default(''),
    errors: z.array(z.object({ reason: z.string() })).default([]),
  }),
});
