# Naming technically relevant IDs — Using naming conventions for BPMN IDs — Editing IDs with Camunda Modeler

We recommend using Camunda Modeler's properties panel on the right side of the screen to edit technical identifiers and change them according to your naming conventions, like it is shown here for the process ID:

![Properties Panel](naming-technically-relevant-ids-assets/camunda-modeler-properties-panel.png)

We especially do not recommend editing identifiers in the XML directly, as it might accidentally corrupt your BPMN file. You have to keep the identifiers in the section about the graphical layout (so called "DI" for diagram interchange) further down in sync with the execution semantics at the top of the XML.

However, we include an XML example of all those identifiers mentioned for illustration:

```xml
<process id="TweetApprovalProcess" name="Tweet Approval"> <!--1-->
  <StartEvent_ id="StartEvent_NewTweetWritten" name="New tweet written"> <!--2-->
    <Message_EventDefinition Message_Ref="Message_NewTweetWritten" />
  </StartEvent_>
  <UserTask_ id="UserTask_ReviewTweet" name="Review tweet"></UserTask_> <!--3-->
  <Gateway_ id="Gateway_TweetApproved" name="Tweet approved?"> <!--4-->
  </Gateway_>
  <SequenceFlow_ id="SequenceFlow_TweetApprovedNo" name="No"> <!--5-->
  </SequenceFlow_>
  <BoundaryEvent_ id="BoundaryEvent_TweetDuplicated" name="Tweet duplicated"> <!--6-->
    <Error_EventDefinition Error_Ref="Error_TweetDuplicated" />
  </BoundaryEvent_>
  <EndEvent_ id="EndEvent_TweetPublished" name="Tweet published"> <!--7-->
  </EndEvent_>
</process>

<Message_ id="Message_NewTweetWritten" name="Msg_NewTweetWritten" /> <!--2-->
<Error_ id="Error_TweetDuplicated" name="Tweet duplicated" Error_Code="Err_TweetDuplicated" /> <!--6-->
...
 <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="TweetApprovalProcess">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent__1" bpmnElement="StartEvent_NewTweetWritten"> <!--8-->
        <dc:Bounds x="100" y="50" width="36" height="36" />
      </bpmndi:BPMNShape>
```

**(8)**

Elements in the diagram interchange section (DI) reference identifiers from above; you have to adjust them accordingly! Camunda Modeler takes care of this automatically.

Changing IDs can potentially break your tests or even process logic if done at a late stage of development. Therefore, consider using meaningful IDs right from the beginning and perform the renaming as part of the modeling.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/naming-technically-relevant-ids
