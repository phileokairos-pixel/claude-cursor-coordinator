# Social preview image

The SVG source is at `.github/social-preview.svg`. GitHub social preview requires PNG/JPG/GIF, so you need to convert it once.

## Convert SVG → PNG (3 minutes)

**Easiest: online converter**
1. Go to https://cloudconvert.com/svg-to-png (or any SVG-to-PNG tool)
2. Upload `.github/social-preview.svg`
3. In options, set output dimensions: **width 1200, height 630**
4. Convert → download `social-preview.png`

**Alternative: browser screenshot**
1. Open `.github/social-preview.svg` in your browser (drag the file in)
2. Use Windows Snipping Tool (Win+Shift+S) to capture the image
3. Save as PNG at 1200×630

## Upload to GitHub

1. Go to https://github.com/phileokairos-pixel/claude-cursor-coordinator/settings
2. Scroll to "Social preview" section
3. Click "Edit"
4. Upload `social-preview.png`
5. Save

Done. Now when anyone shares the repo link on Twitter, Slack, Discord, LinkedIn, etc., your custom banner shows up instead of plain text.

## Editing the design

If you want to change the SVG (different tagline, your logo, color tweaks):
1. Open `.github/social-preview.svg` in a text editor or browser
2. SVG is just XML — readable text, no proprietary tools needed
3. Change text, re-export PNG, re-upload to GitHub

## Why this matters

Without a custom social preview: link previews show plain repo name + description on a flat background. Easy to scroll past.

With it: branded banner with the trailer-signing visual immediately communicates what the tool does. Way more clicks.

30 minutes of work, permanent value every time someone shares the link.
