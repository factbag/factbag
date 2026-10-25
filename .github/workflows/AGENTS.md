# GitHub Actions

Pin every remote action and reusable workflow in `uses:` to its full commit SHA,
with the corresponding release tag in a comment (for example, `# v2.1.2`). Do not
use mutable tags or branches as the ref. Pin Docker actions to a `sha256` image
digest. Local actions referenced with `./` use the checked-out commit and need no
separate pin.
