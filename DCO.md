# Developer Certificate of Origin

Recapito uses the **Developer Certificate of Origin (DCO)** rather than a
Contributor Licence Agreement.

## Why DCO and not a CLA

A CLA asks you to assign or licence your copyright to the project owner. That is
what makes selling commercial licences possible — but it also asks contributors
to sign a legal document before their first patch, and it concentrates rights in
one person.

Looking at comparable projects, the ones with real IP-granting CLAs are almost
all venture-backed companies; community and solo-maintained projects use a DCO.
ownCloud's CLA was a direct factor in the Nextcloud fork, and ownCloud itself
moved to a DCO afterwards.

So: **you keep your copyright.** You certify that you have the right to submit
the code, and it is contributed under the project's licence
(`AGPL-3.0-or-later`). Nothing is signed over to anyone.

## How to sign off

Add a `Signed-off-by` line to each commit. Git does it for you:

```bash
git commit -s -m "fix: handle empty IMAP folder listing"
```

which appends:

```
Signed-off-by: Your Name <your.email@example.com>
```

Use your real name and an email you can be reached at. Pseudonymous
contributions are welcome, but the sign-off should be consistent.

Forgot on the last commit:

```bash
git commit --amend -s --no-edit
```

Across several commits on a branch:

```bash
git rebase --signoff main
```

## What you are certifying

The full text is below, from <https://developercertificate.org/>.

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```
