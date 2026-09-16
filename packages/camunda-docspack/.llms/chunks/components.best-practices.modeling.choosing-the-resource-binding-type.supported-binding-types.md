# Choosing the resource binding type — Supported binding types

Camunda 8 supports the following binding types:

  
    
      Type
      Description
    
  
  
    
      latest
      
        Resolves to the latest deployed version of the target resource at the moment the process element is activated.
        
          
            
              You can use this option to easily change the target resource at runtime by deploying a new version of the resource.
              This allows for fast, iterative development, and easy hot fixes in production:
            
            
              Process instances that have not yet reached the process element use the newly deployed version of the target resource once the element is activated.
              If the process element has already been reached, you can use process instance modification to reactivate and relink it to the newly deployed target resource version.
            
          
          Be aware that using latest can lead to unexpected behavior if you deploy a new version of the target resource without ensuring backwards compatibility with every deployed process that depends on it.This might not be suited for production environments that require stability and a predictable behavior.
        
      
    
    
      deployment
      
        Resolves to the specific version of the target resource that was deployed together with the currently running version of the process in the same deployment.
        
          This option ensures predictable behavior by tying the two versions together, and allows you to deploy future versions of the target resource without disrupting ongoing process instances.
          It is ideal for self-contained projects without external or shared dependencies.
          
            
              To use the deployment binding option, create and deploy a project in Camunda Hub,
              or deploy multiple resources together via the  Zeebe API.
            
          
        
      
    
    
      versionTag
      
        Resolves to the specific version of the target resource that is annotated with the given version tag.
        
          
            
              The version tag is a user-provided string (for example 1.2.0.Final) that makes it easy to identify a certain version of a resource and track it across multiple deployment stages (e.g. dev, test, prod).
              You can set the version tag for a BPMN process, DMN decision, or Form in the Modeler's properties panel.
            
          
          A version tag is different from the numeric process definition version assigned by the Orchestration Cluster.
          Using the versionTag binding option ensures that the right version of the target resource is always used, regardless of future deployments, by pinning the dependency to a specific version.
          The option is ideal for managing external or shared dependencies.
        
        Caution:
        
          
            
              If the target resource ID and version tag pair are not deployed, the process instance will have an incident.
              To avoid this situation, ensure the version tag defined in the call activity, business rule task, or user task matches the version tag in the dependent resource.
            
          
          
            
              Be aware that you can deploy a new version of a resource with an already existing version tag.
              In this case, the version tag reference will be updated and point to the latest deployed version.
            
          
        
      
    
  

**Note**
If the binding type is not explicitly specified in your BPMN diagram, `latest` is used as the default.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/choosing-the-resource-binding-type
