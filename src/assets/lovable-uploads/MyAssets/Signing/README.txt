THE SIGNING EXPERIENCE — REAL SCREENSHOTS GO HERE
=================================================

The signing chapter on the site (#signing, "גם על הדברים הקטנים חשבנו") is built
and wired to the three files below. Save the owner's real screenshots at these
exact paths and the chapter fills itself in - no code change is needed.

  signing-sign.png        THE HERO. The signature screen: "חתימה / חתמי בתוך
                          המסגרת", the signing box, and the save-and-send action.
                          This is the largest plate in the composition.

  signing-agreement.png   The agreement itself, scrolled to the signature block
                          ("חתימת הלקוח"). This is the proof that a real contract
                          is being signed, not a form.

Notes
-----
* Portrait screenshots. Anything close to a phone's aspect (roughly 1:2) composes
  correctly; the frames crop to a consistent ratio rather than distorting.
* PNG or JPG. Save at the exact filename above - the chapter loads whatever is
  at that path. There is no webp <source>: it would win over the PNG in every
  browser that supports it, and a missing webp would take the whole chapter down.
* Until the files exist, each frame removes itself on load error, so the page
  never shows a broken image and never shows an empty box.
* The personal names and phone numbers visible in these screenshots are treated
  as incidental image content. They are not transcribed into markup, alt text or
  any indexable copy anywhere on the site.
