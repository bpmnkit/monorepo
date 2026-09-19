# Versioning process definitions — Avoid versioning of dependant artifacts

When versioning process or decision definitions, you need to be aware that the process of course communicates with the outside world, e.g. by _calling services_ or by _using forms_ to collect data input from human users. All the additional artifacts needed for that might _depend_ on the details of each other in a subtle way.

Whenever possible, we recommend that you _avoid to version other artifacts_ beyond the process and/or decision definitions, in other words, just version '.bpmn' and '.dmn' files by using the default mechanism of the process engine. Embed all other artifacts (like e.g. classes, templates, scripts) into your normal application (for example a Java or Node.js application) and don't version them.

Of course, this approach requires that you _manage the subtle differences_ needed by running process instances of old versions. There are various options to do that. And even if some of those options discussed below might not sound 'ideal' from a theoretical point of view, they proved to be _good enough_ for real life purposes and _much easier to understand_ than complex approaches. As understandability by every team member is a very important argument, we recommend going for the approach that is as simple as possible.

The following options us a Java example of a process solution, containing not only the process model, but also some Java code and an HTML form:

![Sample Process Application](versioning-process-definitions-assets/process-solution-example.png)

### Option 1: Keep the artifacts backwards compatible

_Extend_ the functionality of e.g. a method in `MyClass.java` in a way which can still deal with "old" process instances.

```java
public class MyClass {
  public void doSomething(Long customerId) {
	if(customerId != null) { // <1>
	  // new code introduced
    }
  }
}
```

**(1)**

Assume you introduced a customerId in the new version of the process. Your code can still deal with old cases not aware of a customerId.

### Option 2: Introduce a new artifact for different versions

_Change_ the artifact and add a new version of it to the application. Now you can reference this new artifact from your new version of the process definition, while the old version will continue to use the first version of it.

For example:

- Change the file name for the form from `task-form.html` to `task-form-v2.html`
- Change the `task type` of a service task from `doSomething` to `doSomethingV2`

![Sample Process Application](versioning-process-definitions-assets/process-solution-v2.png)

Sometimes it is preferable to manage different versions by means of folders/packages. Just make sure to have a clear and straightforward convention to keep track of the versions.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/versioning-process-definitions
