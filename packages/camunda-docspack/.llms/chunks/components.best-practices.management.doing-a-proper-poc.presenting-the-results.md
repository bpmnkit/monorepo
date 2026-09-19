# Doing a proper POC — Presenting the results

Before presenting the results of your POC to a wider audience of stakeholders, select a _speaker_ who is comfortable with presenting, prepare a set of focused _slides_ illustrating your progress and the lessons learned, and _test_ your solution and presentation at least once up front.

The speaker might also be your Camunda Consultant - they are used to presenting to a wide audience!


## Checklists

### Technical

- _Cloud Access_: Make sure you have an account for Camunda 8 with an active subscription or trial account.

- _Installations_: Make sure your _developer systems_, as well as any _target systems_ for the POC test and production you wish to use are set up. In particular install:
  - Camunda _Modeler_ (https://camunda.org/download/modeler/)
  - Java, Maven, and your favorite IDE (e.g. Eclipse)
  - Make sure _Maven_ runs and builds and it can access all necessary dependencies. [Download and build this project](https://github.com/camunda/camunda-platform-tutorials/tree/main/quick-start/microservice-orchestration/worker-java) to verify that your build runs.

- _Developer Computers_: For maximum productivity, all participating developers should use the computer with which they work every day. Avoid using computers from a training room or shared laptops unless they allow a remote connection to the developer's personal computer. If the developer's computers are neither portable nor remotely accessible consider conducting the POC in the regular office space of the developers. If your company network is restricting access to Maven and Git repositories on the internet, consider using laptops that are not connected to the company network. Similarly, you should not force the external consultants to work on one of your computers. They will be twice as productive on their laptops and not lose time with software setup, configuration, and access restrictions. Obviously, you do not have to connect the consultant's laptop to your company network. Internet access and a shared code repository are enough to collaborate.

- _Files_ or _Version Control System_: Make sure we can easily exchange files and code during the POC, preferably via your own version control system (e.g. Git or SVN) or at least via shared folders, USB sticks, or email attachments.

- _Interfaces_: Clarify which technical systems' interfaces you want to access during your POC, make any _documentation_ for those available to the whole POC team, and make sure there is a technically knowledgeable _contact person_ for the interface available to the team during the POC. Set up a _test system_ and verify that it is usable. Verify with Camunda that everything is clear to the team, in particular from a technological perspective.

### Organizational

Inform all POC team members and other relevant stakeholders about the following:

- _Goals_ and the selected _scope_ for the POC
- _Start_ and _end times_, as well as any additional preparation/meet-up times
- _Names and roles_ of all involved _people_

- For onsite POCs:
  - Exact _location/address_ at which the POC is taking place as well as instructions about how to find together when arriving (for onsite POCs)
  - _Projector_, white-board, and flip-chart availability
  - _Internet_ availability for team members and external consultants

- For remote POCs:
  - Exact meeting setup. For example, links to the meeting room, passwords, etc. In case you can't easily host meetings for external participants, your Camunda consultant can setup a Zoom or Microsoft Teams call.
  - Ideally, some chat capability (e.g. a temporary Slack account)

Ideally, prepare a few _organizational_ and/or _project_ info slides to get everybody up to speed on day one of the workshop.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/management/doing-a-proper-poc
