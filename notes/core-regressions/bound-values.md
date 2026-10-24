# Bound-value constraints

This PR includes the regression examples and fix from `afb79b2`. A queried or previously bound value must constrain a let binding or aggregate, rather than being silently overwritten. Both examples now run as ordinary passing tests.

The disjunction fix bundle builds on this change. Core tests and the repository commit checks are run before publishing.
