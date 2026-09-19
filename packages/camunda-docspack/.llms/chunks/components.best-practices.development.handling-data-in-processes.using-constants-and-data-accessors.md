# Handling data in processes — Using constants and data accessors

Avoid the copy/paste of string representations of your process variable names across your code base. Collect the variable names for a process definition in _constants_. For example, in Java:

```java
public interface TwitterDemoProcessConstants {
  String VAR_NAME_TWEET = "tweet";
  String VAR_NAME_APPROVED = "approved";
}
```

This way, you have much more security against typos and can easily make use of refactoring mechanisms offered by your IDE.

However, if you also want to solve necessary type conversions (casting) or probably even complex serialization logic, we recommend that you use a **Data Accessor** class. It comes in two flavors:

- A **Process Data Accessor**: Knows the names and types of all process variables of a certain process definition. It serves as the central point to declare variables for that process.
- A **Process Variable Accessor**: Encapsulates the access to exactly one variable. This is useful if you reuse certain variables in different processes.

Consider, for example, the BPMN "Publish on Twitter" task in the Tweet Approval Process:

Diagram (BPMN): TwitterDemoProcess
  start "New Tweet written" → user task "Review tweet" → exclusive gateway "Tweet approved?"
    — [Yes: =approved] service task "Publish on Twitter" → end "Tweet published"
    — [No: =not(approved)] service task "Send rejection notification" → end "Tweet rejected"

**(1)**

We use a **TweetPublicationDelegate** to implement the "Publish on Twitter" task:

```java
public class PublishTweetJobHandler implements JobHandler  {
    public void handle(JobClient client, ActivatedJob job) throws Exception {
        String tweet = job.getVariablesAsType(TwitterDemoProcessVariables.class).getTweet();
        // ...
```

The `tweet` variable is accessed in a type safe way.

This reusable **Process Data Accessor** class could, for example, be a simple object. The Java client API can automatically deserialize the process variables as JSON into this object, while all process variables that are not found in that class are ignored.

```java
public class TwitterDemoProcessVariables {

    private String tweet;
    private boolean approved;

    public String getTweet() {
        return tweet;
    }

    public void setTweet(String tweet) {
        this.tweet = tweet;
    }
}
```

The getters and setters could further take care of additional serialization and deserialization logic for complex objects.

Your specific implementation approach might differ depending on the programming language and framework you are using.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/handling-data-in-processes
