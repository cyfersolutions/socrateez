import { Router } from "express";
import { getJobFacets, searchFacet, searchJobs } from "../services/jobSearchService.js";

const router = Router();

router.get("/facets", async (req, res, next) => {
  try {
    const facets = await getJobFacets();
    res.json(facets);
  } catch (err) {
    next(err);
  }
});

/** Typeahead search for a single facet type (company, city, skill). */
router.get("/facets/search", async (req, res, next) => {
  try {
    const { type, q, limit } = req.query;
    const results = await searchFacet(type, q, Number(limit) || 20);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    const result = await searchJobs(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
