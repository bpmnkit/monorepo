# Following the customer success path

Follow certain steps and Best Practices when evaluating and introducing process automation to help make it a success.

Following certain steps when evaluating and introducing process automation helps to make it a success. Ensure you review the appropriate best practices at the right time.


## Understanding the customer success path

When introducing Camunda as a new process automation platform inside your company, the following process has shown to work best:

Diagram (BPMN):
  start → "Evaluate BPM potential"
    — "Setup process architecture and landscape" → end
    — "Evaluate products and select Camunda"
      — "Identify "lighthouse" process" → intermediate throw event "Project prepared" → "Perform Proof of Concept (PoC)" → intermediate throw event "PoC implemented" → "Develop pilot" → "Prepare operations" → "Go live" → intermediate throw event "Pilot implemented" → "Review pilot" → "Improve "lighthouse" pilot" → intermediate throw event "Further develop- ment prepared" → "Implement next process" → end
      — "Build custom BPM platform" → end
  lanes: Process Architecture, Project, Enterprise Architecture
  note: At first, do just enough to identify "lighthouse" process and to argue for BPM approach
  note: Do as little as possible as late as possible!

**(1)**

_Evaluation_: Take the philosophy of the evaluated products into greater consideration than working solely with feature matrices. Practical experience can be invaluable. You might be interested in our [Whitepaper: "Camunda compared to alternatives"](https://page.camunda.com/wp-camunda-compared-to-alternatives).

**(2)**

_Process selection_: It is very important to select a suitable pilot process. Use a relevant process where you can show benefits of BPM including a Return on Invest (ROI) calculation. However, avoid too big or too "political" processes to minimize the risk of failure due to avoidable reasons. Note that you can use this process in the proof of concept (PoC) or select a different process for the first PoC, depending on the goals you have.

**(3)**

_Proof of Concept_ (PoC): Model the process to a high standard. It should be clear, understandable, and precise, as it will have a high visibility. Include necessary technical proofs, like calling real services in your environment. Include human tasks if your process where appropriate. We suggest using Camunda Tasklist as a first step to save effort in developing your own tasklist, unless a tasklist is important for your overall proof. Include "eye candies" like reporting to make non-technical stakeholders happy. Concentrate on the important aspects to do the proof and prepare to throw away the code afterwards to start fresh for the pilot, as it is very valid for early POCs to be "hacky" in order to keep focus on the end goals.

**(4)**

_Development_: Model the process with the same standard described for a PoC. It should be clear, understandable, and precise. Again, the reason for this is that it will be the most visible part of the project. Develop the project in an iterative manner to learn fast. Do proper testing to achieve a high quality.

**(5)**

_Operations_: Prepare for real operations, which includes setting up the real hardware as well as securing and monitoring the platform.

**(6)**

_Pilot review_ and _Pilot improvements_: Review the project after it has finished and gone live. Take some time to clean up, as the project normally serves as a "lighthouse" and "copy and paste" template for sequential projects, so it is worth the effort. It's better to plan time for this phase than try to make things perfect during early development, as you will have learned a lot once the pilot runs on the live system for a while.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/management/following-the-customer-success-path
