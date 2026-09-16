# User tasks — Additional resources

### XML representations

#### Camunda Form

A user task with a linked Camunda Form that does not specify the binding type (`latest` is used implicitly) as well as an assignment definition and a task schedule:

```xml
<bpmn:userTask id="configure" name="Configure">
  <bpmn:extensionElements>
    <zeebe:formDefinition formId="configure-control-process" />
    <zeebe:assignmentDefinition assignee="= default_controller"
                                candidateGroups="controllers, auditors" />
    <zeebe:taskSchedule dueDate="= task_finished_deadline"
                        followUpDate="= now() + duration(&#34;P12D&#34;)" />
    <zeebe:userTask />
  </bpmn:extensionElements>
</bpmn:userTask>
```

A user task with a linked Camunda Form that uses the `deployment` binding type:

```xml
<bpmn:userTask id="configure" name="Configure">
  <bpmn:extensionElements>
    <zeebe:formDefinition formId="configure-control-process" bindingType="deployment" />
    <zeebe:userTask />
  </bpmn:extensionElements>
</bpmn:userTask>
```

A user task with a linked Camunda Form that uses the `versionTag` binding type:

```xml
<bpmn:userTask id="configure" name="Configure">
  <bpmn:extensionElements>
    <zeebe:formDefinition formId="configure-control-process"
                          bindingType="versionTag" versionTag="v1.0" />
    <zeebe:userTask />
  </bpmn:extensionElements>
</bpmn:userTask>
```

#### Custom form reference

A user task with an external task form referenced by a custom form reference:

```xml
<bpmn:userTask id="configure" name="Configure">
  <bpmn:extensionElements>
    <zeebe:formDefinition externalReference="custom-key" />
    <zeebe:userTask />
  </bpmn:extensionElements>
</bpmn:userTask>
```

**Info**
If you choose the [job worker implementation](#job-worker-implementation) for a user task, the custom form reference needs to be set to the `formKey` attribute instead of the `externalReference` attribute.

#### Camunda Form (embedded)

**Info**
This is only supported if you choose the [job worker implementation](#job-worker-implementation) for a user task.

A job-based user task with an embedded Camunda Form:

```xml
<bpmn:process id="controlProcess" name="Control Process" isExecutable="true">
  <bpmn:extensionElements>
    <zeebe:userTaskForm id="userTaskForm_configure-control-process">
      <!-- Task Form Content -->
    </zeebe:userTaskForm>
  </bpmn:extensionElements>
  <bpmn:userTask id="configure" name="Configure">
    <bpmn:extensionElements>
      <zeebe:formDefinition formKey="camunda-forms:bpmn:userTaskForm_configure-control-process" />
    </bpmn:extensionElements>
  </bpmn:userTask>
</bpmn:process>
```

#### User task listeners

A user task with user task listeners configured:

```xml
<bpmn:userTask id="configure" name="Configure">
  <bpmn:extensionElements>
    <zeebe:taskListeners>
      <zeebe:taskListener eventType="assigning" type="assigning-user-task-listener" retries="5" />
      <zeebe:taskListener eventType="completing" type="completing-user-task-listener" />
    </zeebe:taskListeners>
    <zeebe:userTask/>
  </bpmn:extensionElements>
</bpmn:userTask>
```

### References

- [Tasklist](https://docs.camunda.io/docs/next/components/tasklist/introduction-to-tasklist)
- [Form linking in Modeler](https://docs.camunda.io/docs/next/components/hub/workspace/modeler/modeling/advanced-modeling/form-linking)
- [Job handling](https://docs.camunda.io/docs/next/components/concepts/job-workers)
- [Variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)
- [User task listeners](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners)

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks
