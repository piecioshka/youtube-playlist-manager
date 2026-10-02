# YouTube Playlist Manager

The vocabulary of an app that manages the playlists of one signed-in YouTube channel. Use these terms in code, tests, commits and reviews.

## Language

### Playlist

A playlist owned by the signed-in channel, as YouTube describes it: title, description, visibility, creation date and number of videos.

_Avoid_: list, collection

### Playlist list

Every playlist of the signed-in channel, loaded once per session and shared by the table and the playlist profile. It is the only place where a playlist is updated or deleted.

_Avoid_: library, store, cache

### Playlist profile

The page of one playlist from the playlist list: its details, the edit form, its videos and the delete action.

_Avoid_: playlist page, details view

### Gone playlist

A playlist that YouTube no longer knows (a 404 on update or delete). The playlist list drops it and the profile closes.

_Avoid_: missing playlist, deleted playlist (that one was deleted here, by the user)

### Playlist video

One entry of a playlist: a video together with its position in that playlist. YouTube calls it a playlist item, and the same video can be an entry twice.

_Avoid_: item, track

### Unavailable video

A playlist video that can no longer be watched because the video was deleted or made private. It stays in the playlist until it is removed.

_Avoid_: broken video, dead video

### Video index

The titles of the watchable videos of every playlist, fetched on the first search and kept in memory, so that searching finds playlists by the videos they contain.

_Avoid_: search cache

### YouTube session

The signed-in connection to YouTube for one access token. It performs every YouTube operation and reports its own expiry once.

_Avoid_: client, API, token

### Notice

The message shown above the table after a playlist was deleted or turned out to be gone.

_Avoid_: toast, alert, banner
