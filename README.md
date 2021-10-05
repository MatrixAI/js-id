# js-id

[![pipeline status](https://gitlab.com/MatrixAI/open-source/js-id/badges/master/pipeline.svg)](https://gitlab.com/MatrixAI/open-source/js-id/commits/master)

ID generation for JavaScript & TypeScript applications.

* UUIDv4
* UUIDv7 & UUIDv8
* BYO CSPRNG
* BYO clock source for monotonic process restarts
* Source IDs are in binary form which means they are provided as `ArrayBuffer`
* Can encode IDs using multibase or multihash.

Note that multihash means that it is hashed, but not yet encoded.

Multicodec.

> The first decision is whether or not to use multibase. Multibase enables us to easily upgrade base encodings if we need to (or use different base encodings for the same key material). I think this is a fairly easy decision and we should do this.

This will enable multibase header.

> The second decision is whether or not to use multicodec. Using multicodec enables us to identify public key material as either a multihash (e.g. for RSA keys) or raw bytes (e.g. for ed25519 public keys). I think we should do this, but with some reservations which I'll get to at the end of this post.

> The third decision is whether or not to use multihash. If we want to express hashes for public keys, I think we should do this, but again, with some reservations, which I'll get to at the end of this post.

Expressing a `base58btc encoded` `ed25519` cryptographic identifier would look like this:

```
0x7a 0xed01 ED25519_PUBLIC_KEY_BYTES
```

The `0x7a` is base58btc, and `0xed01` is ed25519. then just raw bytes. When encoded it is just string:

```
z2DhMLJmV8kNQm6zeWUrXQKtmzoh6YkKHSRxVSibscDQ7nq
```

The multihash has a hash type, and hash length, and bytes.

* You chooose the key type
* You choose the hash function (hashes over the raw key bytes) - this is optional
* You choose the encoding (encodes the bytes, in a mapping that is useful)

Ok so multicodec is ultimately used to select the key type, and thus what the actual data is.

The hash function is also chosen.

Finally the encoding is used.

Which part of this problem is part of ID?

1. multiid - time based, uuid based... etc?

If it is a decentralized id, we have to choose the correct encoding? The id is binary form, then we have to encode it appropriately.

So we have to encode it with UUID style?

128 bits - that's the idea. Which means 16 byte keys. That's standard form.

I think multibase could be used later. So I guess that the UUID forms?


## Installation

```sh
npm install --save @matrixai/id
```

## Development

Run `nix-shell`, and once you're inside, you can use:

```sh
# install (or reinstall packages from package.json)
npm install
# build the dist
npm run build
# run the repl (this allows you to import from ./src)
npm run ts-node
# run the tests
npm run test
# lint the source code
npm run lint
# automatically fix the source
npm run lintfix
```

### Docs Generation

```sh
npm run docs
```

See the docs at: https://matrixai.github.io/js-id/

### Publishing

```sh
# npm login
npm version patch # major/minor/patch
npm run build
npm publish --access public
git push
git push --tags
```
