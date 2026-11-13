<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep uploaded pitch slides in a root React provider for the current tab session; navigation must preserve slides without uploading private deck files to a service.
- Import PDF decks with dynamically loaded PDF.js in the browser, and sync slide cues to the existing prompter elapsed timer so pause and reset remain aligned.
- Derive deck total time from the last cue plus its editable final-slide duration in the root deck provider; apply it as the saved locked pitch limit when deck timing changes so slides and countdown share one clock.
