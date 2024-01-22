# How to Release - For Maintainers

0. make sure CI is passing, because this will bypass linting and testing
1. change the version
```bash
./scripts/set-version.sh a.b.c
```
2. commit the change
3. tag the commit
4. push the commit and tag
```bash
git push origin
git push origin --tags
```
5. CI will build docker images and push them to docker hub
6. create a release on github
```bash
gh release create
```