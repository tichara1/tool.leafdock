# Third-party notices

Leafdock's original application code is MIT-licensed. Dependencies retain their
own licenses; MIT does not replace their copyright and attribution terms.

`npm run notices` collects the full license and notice files for every production
dependency. `npm run build` runs this automatically and ships the result at
`/THIRD_PARTY_NOTICES.txt`, both in the web build and Docker image. Generation
fails when a package's license information cannot be located.

- DM Sans and Manrope fonts: SIL Open Font License 1.1.
- DOMPurify: used under the Apache-2.0 option of `(MPL-2.0 OR Apache-2.0)`.
- React, Mermaid, KaTeX, Express, and many supporting packages: MIT.
- Other packages: ISC, BSD, Apache-2.0, and Unlicense; see generated notices.
- `licenses/remark-math-MIT.txt` preserves the upstream monorepo license for two
  packages that omit it from their npm tarballs. FastDOM and StrictDOM include
  their complete license in their README; the generator retains those sections.

No external stock images are bundled. The UI uses CSS, Lucide icons, and local
font packages. Example documentation is part of this project. Third-party product
names belong to their owners; this project is independent and is not endorsed
by Microsoft, Anthropic, OpenAI, or Google. MIT is not a trademark-clearance warranty.
