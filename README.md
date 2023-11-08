# Introduction

A smart contract framework that decentralized loyalty system

This project contains a number of packages.

## Contract

This package contains the code for the smart contract.


## Contact Library

This package is what is needed to create an SDK by utilizing the code of the smart contract.

## Faker

This package functions to store fake purchase data in a smart contract.

## Relay

This package has two functions.
1. It functions to relay the user's transactions to the blockchain
2. The payment information received from the kiosk is approved by the user and then the smart contract is called.

[More](./packages/relay/README.md)

## Subgraph

The Graph is a protocol for building decentralized applications (dApps) quickly on Ethereum and IPFS using GraphQL. 
The Graph CLI takes a subgraph manifest (defaults to subgraph.yaml) with references to:
- A GraphQL schema,
- Smart contract ABIs, and
- Mappings written in AssemblyScript.

It compiles the mappings to WebAssembly, builds a ready-to-use version of the subgraph saved to IPFS or a local directory for debugging, and deploys the subgraph to a Graph Node.