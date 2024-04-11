# How to Release - For Maintainers

0. make sure CI is passing, because this will bypass linting and testing
1. change the version
```bash
./scripts/set-version.sh a.b.c
yarn run lint # make sure not to commit linting errors
cargo check # update cargo.lock
```
2. commit the change
```bash
git commit -m "bump version to a.b.c"
```
3. tag the commit
4. push the commit and tag
```bash
git push origin
git push origin --tags
```
1. CI will build docker images and push them to docker hub
2. create a release on github
```bash
gh release create
```
