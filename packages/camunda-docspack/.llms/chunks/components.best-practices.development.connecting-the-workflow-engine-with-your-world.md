# Connecting the workflow engine with your world

To sketch the basic architecture of your solution, learn how to connect the Zeebe workflow engine with your application or remote system.

One of your first tasks to build a process solution is to sketch the basic architecture of your solution. To do so, you need to answer the question of how to connect the workflow engine (Zeebe) with your application or with remote systems.

The workflow engine is a remote system for your applications, just like a database. Your application connects with Zeebe via remote protocols (like [gRPC](https://grpc.io/) or REST), which is typically hidden from you, like when using a database driver based on ODBC or JDBC.

With Camunda 8 and the Zeebe workflow engine, there are two basic options:

1. Write some **programming code** that typically leverages the client library for the programming language of your choice.
2. Use some **existing connector** which just needs a configuration.

The trade-offs will be discussed later; let’s look at the two options first.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/connecting-the-workflow-engine-with-your-world
