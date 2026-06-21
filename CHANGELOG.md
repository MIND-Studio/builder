# Changelog

## [0.5.0](https://github.com/MIND-Studio/builder/compare/v0.4.0...v0.5.0) (2026-06-21)


### Features

* adopt brand lockup + canonical icons (ui[#29](https://github.com/MIND-Studio/builder/issues/29) wave 2) ([#15](https://github.com/MIND-Studio/builder/issues/15)) ([61f0055](https://github.com/MIND-Studio/builder/commit/61f0055b7aa0a327a35e6c2365d8656efb7db560))

## [0.4.0](https://github.com/MIND-Studio/builder/compare/v0.3.0...v0.4.0) (2026-06-20)


### Features

* adopt ui ^0.4.0 fonts + core ^0.7.0 login accent ([#11](https://github.com/MIND-Studio/builder/issues/11)) ([62545a6](https://github.com/MIND-Studio/builder/commit/62545a64b5a8a080395929fa22bb3313a703fa91))

## [0.3.0](https://github.com/MIND-Studio/builder/compare/v0.2.0...v0.3.0) (2026-06-14)


### Features

* authenticate to the bridge via a trusted-service secret (prod) ([#8](https://github.com/MIND-Studio/builder/issues/8)) ([8c43f58](https://github.com/MIND-Studio/builder/commit/8c43f5835dd4077bb3d54bb60eb503f603956d1f))


### Bug Fixes

* fall back to a writable sqlite cache dir (prod EACCES on /build) ([#6](https://github.com/MIND-Studio/builder/issues/6)) ([84cf29a](https://github.com/MIND-Studio/builder/commit/84cf29af1a8e3a6f1ed7c57ecb9de963a851e421))
* install git in the builder runtime image (scaffold push) ([#9](https://github.com/MIND-Studio/builder/issues/9)) ([cf2c775](https://github.com/MIND-Studio/builder/commit/cf2c775562b34ff0b81dcba109cbc9423fd52b76))

## [0.2.0](https://github.com/MIND-Studio/builder/compare/v0.1.3...v0.2.0) (2026-06-11)


### Features

* add AI settings + provider API ([ccd0596](https://github.com/MIND-Studio/builder/commit/ccd0596e69094fba4985577c342d85fd3ba37098))

## [0.1.3](https://github.com/MIND-Studio/builder/compare/v0.1.2...v0.1.3) (2026-06-07)


### Bug Fixes

* guarantee Next's native swc binary in the prod Docker build ([#2](https://github.com/MIND-Studio/builder/issues/2)) ([16bb8dc](https://github.com/MIND-Studio/builder/commit/16bb8dcb659fdf8e5bde6679e7cbf61cf567ca17))
