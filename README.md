# Ladda

Ladda is a framework to build a federation of linked data consumers
where data consumers are connected together, share their SPARQL processing capabilities
and parallelize their queries by delegating them to idle data consumers. 
Ladda implements a dynamic load-balancer that enables inter-query parallelism over TPF clients.

This repo expose the benchmark code, queries and plots.

# Plots

* **localCaceXp_BSBM10M_Warmup_1run.pdf**: 
  TPF client performing BSBM queries, with local cache reset on and off between
  queries execution. Cache hit is the number of triple pattern queries answered locally and
  cache miss is the number of triple pattern queries answered by the server.
* **localCacheXp_DBpedia_Warmup_1run.pdf**:
  TPF client performing DBpedia queries, with local cache reset on and off between
  queries execution. Cache hit is the number of triple pattern queries answered locally and
  cache miss is the number of triple pattern queries answered by the server.
* **makespan_Avg_3runs.pdf**:
  Overall makespan for Ladda 2 (L2) , Ladda K (LK) and our baseline “No
  Delegation” (ND) in the configuration All Loaded, Half Loaded, One Loaded and
  Quarter Loaded.
* **nbExecQueries_AllLoaded_1run.pdf**:
  The number of queries executed per minute over time for Ladda 2 (L2) , Ladda K
  (LK) and our baseline “No Delegation” (ND) in the configuration All Loaded.
* **nbExecQueries_HalfLoaded_1run.pdf**:
  The number of queries executed per minute over time for Ladda 2 (L2) , Ladda K
  (LK) and our baseline “No Delegation” (ND) in the configuration Half Loaded.
* **nbExecQueries_OneLoaded_1run.pdf**:
  The number of queries executed per minute over time for Ladda 2 (L2) , Ladda K
  (LK) and our baseline “No Delegation” (ND) in the configuration One Loaded.
* **nbExecQueries_QuarterLoaded_1run.pdf**:
  The number of queries executed per minute over time for Ladda 2 (L2) , Ladda K
  (LK) and our baseline “No Delegation” (ND) in the configuration Quarter Loaded.
* **resultsTimePerClient_AllLoaded_Avg_3runs.pdf**:
  Results time per client with Ladda 2, Ladda K and ND (No Delegation) for the
  All Loaded configuration.
* **resultsTimePerClient_HalfLoaded_Avg_3runs.pdf**:
  Results time per client with Ladda 2, Ladda K and ND (No Delegation) for the
  Half Loaded configuration: 25 clients with discontinuous ID.
* **resultsTimePerClient_QuaterLoaded_Avg_3runs.pdf**:
   Results time per client with Ladda 2, Ladda K and ND (No Delegation) for the
  Quarter Loaded configuration: 12 clients with discontinuous ID.
* **staticAllocation_1run.pdf**:
  Execution time of 1509 queries from DBPedia log 3.8, statically allocated to 1,
  21 and 50 TPF clients. TPF server is configured with 1, 4 and 8 workers.
* **throughput_Avg_3runs.pdf**:
  The number of queries executed per second for Ladda 2 (L2) , Ladda K (LK) and
  our baseline “No Delegation” (ND) in the configuration All Loaded, Half Loaded, One
  Loaded and Quarter Loaded.
