---
name: gofi-icloud-link
description: "Use when retrieving an existing iCloud share link or creating an explicitly approved share for a specific verified GoFi track or collection folder, without widening library access."
---

# Obtain an iCloud link

Default is read-only discovery. Reuse an existing observed share URL with matching scope and permissions. Never fabricate a link from a local filesystem path.

Creating a link or changing permissions requires user authorization identifying the file/folder and audience. If absent, prepare and verify the exact file first, then ask one concise question: share only this file as anyone-with-link view-only? A past one-file approval does not authorize other files, future downloads, or the entire library. Never persist per-run approval in profile defaults.

Once approved:

1. Verify exact canonical file path, actual FLAC and upload status with gofi-verify-library. For a folder, verify exact collection scope and contents. Do not share a symlink placeholder or a broad parent directory.
2. Prefer an available first-party sharing API; otherwise use the host's authorized computer-use surface. In Finder, select the exact canonical item, Share, then Share a Link. Inspect current Who can access and Permissions before proceeding.
3. For an approved public read-only file link, choose `Anyone with the link` and `Can view or download` (older systems may call it `View only`). Read the resulting summary, then Copy Link. Never leave `Can edit` enabled. Do not select Messages, Mail, or suggested recipients.
4. Observe completed share state (`Shared by Me` or equivalent), read the copied Apple-generated URL, and reopen sharing to verify the persisted audience and permission. Read clipboard through a supported tool or a new disposable local text buffer. Avoid pasting into Finder file view, which can create a .webloc file.
5. Clean up only task-created scratch files/buffers. Report the exact clickable link and scope. Do not stop at a spinner or settings dialog. If iCloud needs login, legal acceptance or another consequential action, follow host confirmation policy.

Existing `GoFi iCloud Link` Shortcuts can create public links: inspect their real behavior before invoking. Do not run them merely to discover an existing link. Do not send link through Messages or another service unless explicitly requested.

Finish with clickable observed URL, file/folder identity, audience, view/download permission, and any unverified cloud availability. No broad library permission changes.
