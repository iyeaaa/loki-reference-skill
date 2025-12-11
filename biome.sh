#!/bin/bash
set -e

(cd admin && yarn lint)
(cd elysia-server && bun lint)
