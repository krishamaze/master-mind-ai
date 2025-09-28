"""
Async memory service with HARDENED OpenAI prompt completion system.
Implements ALL expert recommendations from OpenAI/Mem0 support for production-grade prompt enhancement.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

import httpx
from mem0.client.main import MemoryClient
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

class AsyncMemoryService:
    """
    Async helpers for interacting with Mem0 with v2 API and HARDENED OpenAI completion.
    
    Features:
    - Mem0 GraphMemory v2 API integration
    - HARDENED OpenAI prompt completion with strict length controls
    - Vocabulary-constrained generation to prevent hallucination
    - Pattern-specific handling for "X is..." completions
    - Post-processing guardrails with character limits
    - Stop sequences for single-line completions
    """

    def __init__(self) -> None:
        logger.info("🔧 INIT: Initializing AsyncMemoryService with HARDENED v2 API and GraphMemory")
        
        # Initialize Mem0 client
        try:
            self.client = MemoryClient(
                api_key=settings.MEM0_API_KEY,
                # Add org_id and project_id if available in settings
                # org_id=settings.MEM0_ORG_ID,
                # project_id=settings.MEM0_PROJECT_ID,
            )
            logger.info("✅ INIT: Mem0 client initialized successfully")
            
            # Enable GraphMemory at project level (GraphMemory enhancement)
            try:
                self.client.project.update(enable_graph=True)
                logger.info("✅ INIT: GraphMemory enabled at project level")
            except Exception as exc:
                logger.warn(f"⚠️ INIT: Could not enable GraphMemory (may not be available): {exc}")
                
        except Exception as exc:
            logger.error(f"❌ INIT: Mem0 client initialization failed: {exc}")
            raise
        
        # Initialize OpenAI client for HARDENED completion
        try:
            self.openai_client = AsyncOpenAI(
                api_key=settings.OPENAI_API_KEY
            )
            logger.info("✅ INIT: OpenAI client initialized for HARDENED completion")
        except Exception as exc:
            logger.error(f"❌ INIT: OpenAI client initialization failed: {exc}")
            raise

    async def get_user_app_ids(self, user_id: str) -> List[str]:
        """Get app_ids using Mem0 Entities API - the most efficient approach."""
        logger.info(f"🔍 MEMORY: Getting app_ids for user: {user_id} using Entities API")
        
        try:
            # Use Entities API to get all apps
            logger.info(f"📤 MEMORY: Calling Mem0 /v1/entities/ endpoint")
            headers = {"Authorization": f"Token {settings.MEM0_API_KEY}"}
            async with httpx.AsyncClient() as client:
                logger.info(f"📤 MEMORY: Making HTTP request to entities API")
                response = await client.get("https://api.mem0.ai/v1/entities/", headers=headers)
                response.raise_for_status()
                data = response.json()
                logger.info(f"✅ MEMORY: Entities API HTTP request successful")

            logger.info(f"📥 MEMORY: Entities API returned: {data}")
            logger.info(f"📥 MEMORY: Total apps found: {data.get('total_apps', 0)}")

            # Extract app names from entities (allow any length 3+)
            app_ids = []
            for entity in data.get("results", []):
                if entity.get("type") == "app" and entity.get("total_memories", 0) > 0:
                    app_name = entity.get("name")
                    if app_name and len(app_name.strip()) >= 3:  # Allow 3+ chars instead of 8+
                        app_ids.append(app_name.strip())
                        logger.info(f"📥 MEMORY: Found valid app: {app_name} (memories: {entity.get('total_memories')})")
                    else:
                        logger.info(f"📥 MEMORY: Skipped app (too short): {app_name}")

            logger.info(f"🔍 MEMORY: Extracted valid app_ids: {app_ids}")
            return sorted(app_ids)

        except httpx.HTTPStatusError as exc:
            logger.error(f"❌ MEMORY: HTTP error calling entities API: {exc.response.status_code} - {exc.response.text}")
            return []
        except Exception as exc:
            logger.error(f"❌ MEMORY: Entities API failed: {exc}")
            logger.error(f"❌ MEMORY: Exception type: {type(exc)}")
            logger.error(f"❌ MEMORY: Exception details: {str(exc)}")
            return []

    async def create_assignment(self, user_id: str, app_id: str) -> Dict[str, Any]:
        """Create an assignment with GraphMemory-enabled seed memory."""
        assignment_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc)

        logger.info(f"🆕 ASSIGNMENT: Creating assignment for user={user_id}, app_id={app_id}")
        logger.info(f"🆕 ASSIGNMENT: Generated assignment_id={assignment_id}")

        try:
            logger.info(f"📤 ASSIGNMENT: Adding GraphMemory-enabled seed memory")
            await self.add_memory(
                user_id=user_id,
                app_id=app_id,
                messages=[
                    {"role": "user", "content": f"User {user_id} is starting work on {app_id} project"}
                ],
                enable_graph=True,  # Enable graph for better relationships
            )
            logger.info(f"✅ ASSIGNMENT: GraphMemory-enabled seed memory added successfully")
        except Exception as exc:  # pragma: no cover - network failures
            logger.error(
                f"❌ ASSIGNMENT: Failed to seed assignment memory for user={user_id} app={app_id}: {exc}"
            )

        assignment_data = {
            "id": assignment_id,
            "app_id": app_id,
            "user_id": user_id,
            "status": "created",
            "created_at": created_at,
            "mem0_namespace": f"{user_id}:{app_id}",
        }
        
        logger.info(f"✅ ASSIGNMENT: Created successfully: {assignment_data}")
        return assignment_data

    async def add_memory(
        self, 
        user_id: str, 
        app_id: str, 
        messages: List[Dict[str, Any]],
        enable_graph: bool = True,
        run_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Store memory with GraphMemory support and v1.1 output format."""
        logger.info(f"📤 MEMORY: Adding memory for user_id={user_id}, app_id={app_id}")
        logger.info(f"📤 MEMORY: Messages count: {len(messages)}")
        logger.info(f"📤 MEMORY: GraphMemory enabled: {enable_graph}")
        logger.info(f"📤 MEMORY: run_id: {run_id}")
        logger.info(f"📤 MEMORY: Messages preview: {messages}")

        try:
            logger.info(f"📤 MEMORY: Calling Mem0 add() with GraphMemory")
            
            # Prepare add() parameters
            add_params = {
                "user_id": user_id,
                "app_id": app_id,
                "enable_graph": enable_graph,
                "output_format": "v1.1" if enable_graph else "v1.0"
            }
            
            if run_id:
                add_params["run_id"] = run_id
                
            logger.info(f"📤 MEMORY: Add parameters: {add_params}")
            
            result = await asyncio.to_thread(
                self.client.add,
                messages,
                **add_params
            )

            logger.info(f"📥 MEMORY: Mem0 add returned: {result}")
            logger.info(f"📥 MEMORY: Add response type: {type(result)}")
            logger.info(f"✅ MEMORY: Memory added successfully with GraphMemory")
            return result

        except Exception as exc:
            logger.error(f"❌ MEMORY: Add memory failed: {exc}")
            logger.error(f"❌ MEMORY: Add exception type: {type(exc)}")
            logger.error(f"❌ MEMORY: Add exception details: {str(exc)}")
            raise

    async def two_stage_enhance(
        self,
        *,
        prompt: str,
        user_id: str,
        app_id: Optional[str] = None,
        run_id: Optional[str] = None,
        limit: int = 5,
    ) -> Dict[str, Any]:
        """
        HARDENED prompt enhancement with v2 API, GraphMemory, and expert-recommended strict controls.
        
        Implements ALL OpenAI/Mem0 expert recommendations:
        - Strict numeric character caps (2x-4x expansion)
        - Stop sequences for single-line completions
        - Vocabulary-constrained generation
        - Pattern-specific handling for "X is..." completions
        - Post-processing guardrails with hard truncation
        """
        logger.info(f"🔒 HARDENED ENHANCE: Starting production-grade enhancement")
        logger.info(f"🔒 HARDENED ENHANCE: Input prompt: '{prompt}'")
        logger.info(f"🔒 HARDENED ENHANCE: user_id: {user_id}")
        logger.info(f"🔒 HARDENED ENHANCE: app_id: {app_id}")
        logger.info(f"🔒 HARDENED ENHANCE: run_id: {run_id} (for context info only)")
        logger.info(f"🔒 HARDENED ENHANCE: limit: {limit}")
        
        start_time = time.time()
        
        # Step 1: Light cleanup
        logger.info(f"🧹 CLEANUP: Starting light cleanup")
        cleaned_prompt = self._light_cleanup(prompt)
        logger.info(f"🧹 CLEANUP: '{prompt}' → '{cleaned_prompt}'")
        
        if cleaned_prompt == prompt:
            logger.info(f"🧹 CLEANUP: No changes needed")
        else:
            logger.info(f"🧹 CLEANUP: Cleaned successfully - removed extra whitespace")

        # Step 2: Smart search strategy (hierarchical fallback)
        logger.info(f"🔍 STRATEGY: Starting smart hierarchical search")
        
        search_strategies = []
        
        # Strategy 1: App-wide search (primary for enhancement)
        if app_id:
            search_strategies.append({
                "name": "app_wide_graph",
                "version": "v2",
                "filters": {"app_id": app_id},
                "enable_graph": True,
                "output_format": "v1.1"
            })
            
        # Strategy 2: User-wide search (fallback)
        search_strategies.append({
            "name": "user_wide_graph", 
            "version": "v2",
            "filters": {},
            "enable_graph": True,
            "output_format": "v1.1"
        })
        
        # Strategy 3: Basic search (final fallback)
        search_strategies.append({
            "name": "basic_search",
            "version": "v1",  # Fallback to v1 if v2 fails
            "filters": {"app_id": app_id} if app_id else {},
            "enable_graph": False,
            "output_format": "v1.0"
        })

        memories = []
        used_strategy = None
        
        for i, strategy in enumerate(search_strategies):
            logger.info(f"🔍 STRATEGY {i+1} ({strategy['name']}): {strategy}")
            
            try:
                search_start = time.time()
                
                # Prepare search parameters
                search_params = {
                    "user_id": user_id,
                    "limit": limit,
                }
                
                # Add strategy-specific parameters
                if strategy.get("version") == "v2":
                    search_params["version"] = "v2"
                    if strategy["filters"]:
                        search_params["filters"] = strategy["filters"]
                        
                if strategy.get("enable_graph"):
                    search_params["enable_graph"] = True
                    search_params["output_format"] = strategy["output_format"]
                else:
                    if strategy["filters"]:
                        search_params["filters"] = strategy["filters"]
                
                logger.info(f"📤 STRATEGY {i+1}: Search parameters: {search_params}")
                
                memories = await asyncio.to_thread(
                    self.client.search,
                    cleaned_prompt,
                    **search_params
                )
                
                search_time = time.time() - search_start
                logger.info(f"📥 STRATEGY {i+1}: Found {len(memories or [])} memories in {search_time:.3f}s")
                
                if memories:
                    used_strategy = strategy
                    logger.info(f"✅ SUCCESS: Using strategy {i+1} ({strategy['name']})")
                    logger.info(f"📥 MEMORIES: Raw data: {memories}")
                    break
                else:
                    logger.info(f"❌ STRATEGY {i+1}: No memories found, trying next strategy")
                    
            except Exception as exc:
                logger.error(f"❌ STRATEGY {i+1}: Search failed: {exc}")
                logger.error(f"❌ STRATEGY {i+1}: Exception type: {type(exc)}")
                continue

        if not memories:
            logger.info(f"📥 FINAL: No memories found with any strategy")
        else:
            logger.info(f"✅ FINAL: Found {len(memories)} memories using {used_strategy['name']}")

        # Step 3: Enhanced context building (supports GraphMemory format)
        logger.info(f"🧠 CONTEXT: Building enhanced context from memories")
        context = self._build_enhanced_context(memories, used_strategy)
        
        if context.strip():
            logger.info(f"🧠 CONTEXT: Built rich context (length: {len(context)} chars)")
            logger.info(f"🧠 CONTEXT: Context preview: {context[:300]}...")
        else:
            logger.info(f"🧠 CONTEXT: No meaningful context extracted from memories")
        
        # Step 4: HARDENED enhancement with expert recommendations
        if context.strip():
            logger.info(f"🔒 DECISION: Rich context found - applying HARDENED enhancement")
            enhance_start = time.time()
            
            enhanced = await self._hardened_enhance_with_context(
                prompt=cleaned_prompt,
                context=context,
                user_id=user_id,
                strategy_used=used_strategy["name"] if used_strategy else "none"
            )
            
            enhance_time = time.time() - enhance_start
            logger.info(f"🔒 ENHANCEMENT: HARDENED enhancement completed in {enhance_time:.3f}s")
            logger.info(f"🔒 ENHANCEMENT: Original length: {len(cleaned_prompt)} chars")
            logger.info(f"🔒 ENHANCEMENT: Enhanced length: {len(enhanced)} chars")
            logger.info(f"🔒 ENHANCEMENT: Enhanced preview: {enhanced[:200]}...")
            
        else:
            logger.info(f"📝 DECISION: No relevant context - returning cleaned prompt")
            enhanced = cleaned_prompt

        processing_time = time.time() - start_time
        
        result = {
            "enhanced_prompt": enhanced,
            "memories_used": len(memories or []),
            "processing_time": round(processing_time, 3),
            "strategy_used": used_strategy["name"] if used_strategy else "none",
            "graph_enabled": used_strategy.get("enable_graph", False) if used_strategy else False
        }
        
        logger.info(f"✅ HARDENED ENHANCE: Enhancement completed successfully")
        logger.info(f"✅ HARDENED ENHANCE: Total processing time: {processing_time:.3f}s")
        logger.info(f"✅ HARDENED ENHANCE: Memories used: {result['memories_used']}")
        logger.info(f"✅ HARDENED ENHANCE: Strategy used: {result['strategy_used']}")
        logger.info(f"✅ HARDENED ENHANCE: Graph enabled: {result['graph_enabled']}")
        logger.info(f"✅ HARDENED ENHANCE: Result preview: {result}")
        
        return result

    async def search_memories(
        self,
        *,
        query: str,
        user_id: str,
        limit: int = 5,
        app_id: Optional[str] = None,
        run_id: Optional[str] = None,
        enable_graph: bool = True,
        version: str = "v2"
    ) -> List[Dict[str, Any]]:
        """Enhanced search with v2 API and GraphMemory support."""
        logger.info(f"🔍 SEARCH: Starting enhanced memory search")
        logger.info(f"🔍 SEARCH: query: '{query}'")
        logger.info(f"🔍 SEARCH: user_id: {user_id}")
        logger.info(f"🔍 SEARCH: limit: {limit}")
        logger.info(f"🔍 SEARCH: app_id: {app_id}")
        logger.info(f"🔍 SEARCH: run_id: {run_id}")
        logger.info(f"🔍 SEARCH: enable_graph: {enable_graph}")
        logger.info(f"🔍 SEARCH: version: {version}")
        
        search_params = {"user_id": user_id, "limit": limit}
        
        if version == "v2":
            search_params["version"] = "v2"
            filters = {}
            if app_id:
                filters["app_id"] = app_id
            if run_id:
                filters["run_id"] = run_id
            if filters:
                search_params["filters"] = filters
                
            if enable_graph:
                search_params["enable_graph"] = True
                search_params["output_format"] = "v1.1"
        else:
            # v1 fallback
            filters = {}
            if app_id:
                filters["app_id"] = app_id
            if run_id:
                filters["run_id"] = run_id
            if filters:
                search_params["filters"] = filters

        logger.info(f"🔍 SEARCH: Using parameters: {search_params}")

        try:
            search_start = time.time()
            results = await asyncio.to_thread(
                self.client.search,
                query,
                **search_params
            )
            search_time = time.time() - search_start
            
            logger.info(f"✅ SEARCH: Completed in {search_time:.3f}s")
            logger.info(f"✅ SEARCH: Found {len(results or [])} results")
            logger.info(f"✅ SEARCH: Results: {results}")
            
            return results or []
            
        except Exception as exc:
            logger.error(f"❌ SEARCH: Failed for user={user_id}: {exc}")
            logger.error(f"❌ SEARCH: Exception type: {type(exc)}")
            logger.error(f"❌ SEARCH: Exception details: {str(exc)}")
            raise

    @staticmethod
    def _light_cleanup(prompt: str) -> str:
        """Light cleanup: normalize whitespace only."""
        logger.debug(f"🧹 _light_cleanup: Input: '{prompt}'")
        
        # Remove leading/trailing whitespace and normalize internal whitespace
        cleaned = " ".join(prompt.strip().split())
        
        logger.debug(f"🧹 _light_cleanup: Output: '{cleaned}'")
        return cleaned

    @staticmethod
    def _build_enhanced_context(memories: Optional[List[Dict[str, Any]]], strategy: Optional[Dict[str, Any]] = None) -> str:
        """Enhanced context building with app_id-scoped filtering for GraphMemory relationships."""
        if not memories:
            logger.debug(f"🧠 _build_context: No memories provided")
            return ""

        # Handle both single dict (v2 GraphMemory) and list format
        if isinstance(memories, list):
            memory_data = memories[0] if memories else {}
        else:
            memory_data = memories
            
        logger.debug(f"🧠 _build_context: Processing memory data with strategy: {strategy}")
        
        # Get the target app_id from strategy for filtering
        target_app_id = None
        if strategy and strategy.get("filters"):
            target_app_id = strategy["filters"].get("app_id")
        
        logger.info(f"🧠 _build_context: Target app_id for filtering: {target_app_id}")
        
        segments: List[str] = []
        
        # Extract traditional memory content from results
        results = memory_data.get("results", [])
        if results:
            logger.debug(f"🧠 _build_context: Processing {len(results)} traditional memory results")
            for i, result in enumerate(results):
                if isinstance(result, dict):
                    content = (
                        result.get("content") or 
                        result.get("memory") or 
                        result.get("text") or
                        result.get("message", {}).get("content") if isinstance(result.get("message"), dict) else None
                    )
                    if isinstance(content, str) and content.strip():
                        segments.append(f"Memory: {content.strip()}")
                        logger.debug(f"🧠 _build_context: Added memory content {i}: {content[:50]}...")

        # ✅ EXTRACT AND FILTER GRAPHMEMORY RELATIONS BY APP_ID
        relations = memory_data.get("relations", [])
        if relations:
            logger.info(f"🧠 _build_context: Processing {len(relations)} GraphMemory relations")
            
            # Filter relationships to only include target app_id related ones
            filtered_relations = []
            for relation in relations:
                if not isinstance(relation, dict):
                    continue
                    
                source = relation.get("source", "").strip()
                relationship = relation.get("relationship", "").strip()
                target = relation.get("target", "").strip()
                score = relation.get("score", 0.0)
                
                # Filter out low-confidence relations
                if not (source and relationship and target) or score < 0.3:
                    continue
                
                # ✅ CRITICAL FIX: Only include relations involving the target app_id
                if target_app_id:
                    # Include relation if either source or target matches app_id (case-insensitive)
                    if target_app_id.lower() in [source.lower(), target.lower()]:
                        filtered_relations.append(relation)
                        logger.info(f"🧠 _build_context: ✅ Included relation (matches {target_app_id}): {source} → {relationship} → {target} (score: {score})")
                    else:
                        logger.info(f"🧠 _build_context: ❌ Filtered out relation (no match): {source} → {relationship} → {target}")
                else:
                    # No app_id filter, include all high-confidence relations
                    filtered_relations.append(relation)
                    logger.info(f"🧠 _build_context: ✅ Included relation (no filter): {source} → {relationship} → {target}")
            
            logger.info(f"🧠 _build_context: Filtered to {len(filtered_relations)} relevant relations (from {len(relations)} total)")
            
            # Build contextual segments from filtered relationships
            if filtered_relations:
                work_relations = []
                assignment_relations = []
                project_relations = []
                
                for relation in filtered_relations:
                    source = relation.get("source", "").strip()
                    relationship = relation.get("relationship", "").strip()
                    target = relation.get("target", "").strip()
                    target_type = relation.get("target_type", "").strip()
                    
                    relation_context = {
                        "source": source,
                        "relationship": relationship,
                        "target": target,
                        "target_type": target_type,
                        "score": relation.get("score", 0.0)
                    }
                    
                    # Categorize relationships
                    if relationship in ["starting_work_on", "working_on", "developing"]:
                        work_relations.append(relation_context)
                    elif relationship in ["initiated_assignment", "assigned_to", "assignment"]:
                        assignment_relations.append(relation_context)
                    elif target_type in ["project"] or relationship == "is_related_to":
                        project_relations.append(relation_context)
                
                context_segments = []
                
                # Work relationships - focus on simple completions
                if work_relations:
                    work_items = []
                    for rel in work_relations:
                        if rel["relationship"] == "starting_work_on":
                            work_items.append(f"{rel['source']} is currently starting work on the {rel['target']} {rel['target_type'] or 'project'}")
                        elif rel["relationship"] == "working_on":
                            work_items.append(f"{rel['source']} is actively working on the {rel['target']} {rel['target_type'] or 'project'}")
                        else:
                            work_items.append(f"{rel['source']} {rel['relationship'].replace('_', ' ')} {rel['target']}")
                    
                    context_segments.extend(work_items)
                
                # Assignment relationships
                if assignment_relations:
                    assignment_items = []
                    for rel in assignment_relations:
                        if rel["relationship"] == "initiated_assignment":
                            assignment_items.append(f"{rel['source']} initiated assignment for the {rel['target']} {rel['target_type'] or 'project'}")
                        elif rel["relationship"] == "assignment":
                            assignment_items.append(f"{rel['source']} has assignment relationship with {rel['target']}")
                        else:
                            assignment_items.append(f"{rel['source']} {rel['relationship'].replace('_', ' ')} {rel['target']}")
                    
                    context_segments.extend(assignment_items)
                
                # Project relationships
                if project_relations:
                    project_items = []
                    for rel in project_relations:
                        if rel["relationship"] == "is_related_to":
                            project_items.append(f"{rel['source']} is related to {rel['target']} {rel['target_type'] or 'project'}")
                        else:
                            project_items.append(f"{rel['source']} {rel['relationship'].replace('_', ' ')} {rel['target']}")
                    
                    context_segments.extend(project_items)
                
                segments.extend(context_segments)
                logger.info(f"🧠 _build_context: Added {len(context_segments)} filtered relationship contexts")
        
        context = "\n".join(segments)
        
        if context:
            logger.info(f"🧠 _build_context: Final app_id-filtered context (length: {len(context)} chars):")
            logger.info(f"🧠 _build_context: {context}")
        else:
            logger.info(f"🧠 _build_context: No meaningful app_id-scoped context extracted")
        
        return context

    async def _hardened_enhance_with_context(
        self, *, prompt: str, context: str, user_id: str, strategy_used: str = "unknown"
    ) -> str:
        """
        🔒 HARDENED OpenAI enhancement implementing ALL expert recommendations.
        
        Features:
        - Strict numeric character caps (2x-4x expansion)
        - Stop sequences for single-line completions  
        - Vocabulary-constrained generation to prevent hallucination
        - Pattern-specific handling for "X is..." completions
        - Post-processing guardrails with hard truncation
        - Optimal parameters: temperature=0.1, top_p=0.4
        """
        logger.info(f"🔒 HARDENED: Starting EXPERT-RECOMMENDED enhancement system")
        logger.info(f"🔒 HARDENED: Prompt: '{prompt}' ({len(prompt)} chars)")
        logger.info(f"🔒 HARDENED: Context: '{context}' ({len(context)} chars)")
        logger.info(f"🔒 HARDENED: Strategy used: {strategy_used}")
        logger.info(f"🔒 HARDENED: user_id: {user_id}")
        
        # 📐 STEP 1: Calculate strict length limits (Expert Recommendation #1)
        orig_chars = len(prompt)
        char_max = min(max(2 * orig_chars, 20), 4 * orig_chars)  # 2x-4x clamp
        approx_token_ratio = 4  # ~4 chars/token heuristic
        max_tokens = max(8, math.ceil(char_max / approx_token_ratio))
        
        logger.info(f"🔒 HARDENED: Length limits - orig: {orig_chars}, max: {char_max} chars, tokens: {max_tokens}")
        
        # 📝 STEP 2: Build vocabulary-constrained system prompt (Expert Recommendation #2)
        allowed_vocab = self._build_allowed_vocabulary(prompt, context)
        
        # 🎯 STEP 3: Detect completion pattern and build system message (Expert Recommendation #3)
        is_x_is_pattern = re.search(r"\bis\s*$", prompt.strip(), re.IGNORECASE)
        
        if is_x_is_pattern:
            system_message = (
                f"You complete incomplete prompts concisely.\n"
                f"Hard limits:\n"
                f"- Original length: {orig_chars} chars.\n"
                f"- Absolute max: {char_max} chars (<= 4x).\n"
                f"- Return exactly one short completion (no more than 1 sentence).\n"
                f"- Do not introduce facts not present in PROMPT or CONTEXT.\n"
                f"- No advice, no questions, no preambles, no quotes.\n"
                f"For 'X is' fragments, return a 2–6 word noun phrase; no verbs beyond 'is'.\n"
                f"Use only words from this vocabulary: {', '.join(sorted(list(allowed_vocab))[:50])}"
            )
            user_message = f"Context: {context}\nComplete: {prompt}\nCompletion:"
            logger.info(f"🔒 HARDENED: Using 'X is' pattern-specific mode")
        else:
            system_message = (
                f"You complete incomplete prompts concisely.\n"
                f"Hard limits:\n"
                f"- Original length: {orig_chars} chars.\n"
                f"- Absolute max: {char_max} chars (<= 4x).\n"
                f"- Return exactly one short completion (no more than 1 sentence).\n"
                f"- Do not introduce facts not present in PROMPT or CONTEXT.\n"
                f"- No advice, no questions, no preambles, no quotes.\n"
                f"Use only words from this vocabulary: {', '.join(sorted(list(allowed_vocab))[:50])}"
            )
            user_message = f"Context: {context}\nComplete: {prompt}\nCompletion:"
            logger.info(f"🔒 HARDENED: Using general completion mode")

        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ]

        logger.info(f"🔒 HARDENED: System message length: {len(system_message)} chars")
        logger.info(f"🔒 HARDENED: User message length: {len(user_message)} chars")

        # 🔒 STEP 4: API call with HARDENED parameters (Expert Recommendation #4)
        try:
            logger.info(f"🔒 HARDENED: Making API call with EXPERT-RECOMMENDED parameters")
            logger.info(f"🔒 HARDENED: max_tokens={max_tokens}, temp=0.1, top_p=0.4")
            
            api_start = time.time()
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=max_tokens,           # ✅ Strict token limit from char_max
                temperature=0.1,               # ✅ Lower temperature (≤0.2)
                top_p=0.4,                     # ✅ Restrictive sampling (0.2–0.5)
                presence_penalty=0.0,          # ✅ Keep penalties minimal to avoid drift
                frequency_penalty=0.2,         # ✅ Encourage conciseness
                stop=["\n", "\n\n", "—", "•"]  # ✅ Stop sequences for single-line completions
            )
            api_time = time.time() - api_start

            logger.info(f"✅ HARDENED: API call successful in {api_time:.3f}s")
            logger.info(f"✅ HARDENED: Response object type: {type(response)}")

        except Exception as exc:
            logger.error(f"❌ HARDENED: Enhancement request failed for user={user_id}: {exc}")
            logger.error(f"❌ HARDENED: Exception type: {type(exc)}")
            logger.error(f"❌ HARDENED: Exception details: {str(exc)}")
            logger.info(f"🔄 HARDENED: Falling back to original prompt")
            return prompt

        # Extract content from response
        content = None
        try:
            content = response.choices[0].message.content if response and response.choices else None
            logger.info(f"✅ HARDENED: Extracted content length: {len(content or '')} chars")
        except Exception as exc:
            logger.error(f"❌ HARDENED: Failed to extract content from response: {exc}")

        if isinstance(content, str) and content.strip():
            enhanced = content.strip()
            
            # 🧹 STEP 5: Post-processing guardrails (Expert Recommendation #5)
            enhanced = self._apply_post_processing_guardrails(enhanced, prompt, char_max)
            
            logger.info(f"✅ HARDENED: Enhancement successful")
            logger.info(f"✅ HARDENED: Original: {len(prompt)} chars → Enhanced: {len(enhanced)} chars")
            logger.info(f"✅ HARDENED: Expansion ratio: {len(enhanced)/len(prompt):.1f}x")
            logger.info(f"✅ HARDENED: Enhanced preview: {enhanced[:200]}...")
            return enhanced
        else:
            logger.warn(f"⚠️ HARDENED: No valid content in response - using original prompt")
            logger.warn(f"⚠️ HARDENED: Response content was: {repr(content)}")
            return prompt

    @staticmethod
    def _build_allowed_vocabulary(prompt: str, context: str) -> Set[str]:
        """
        Build vocabulary whitelist from prompt + context + function words.
        (Expert Recommendation: Context-safety guard to prevent hallucination)
        """
        # Extract words from prompt and context
        text = f"{prompt} {context}".lower()
        words = set(re.findall(r'\b\w+\b', text))
        
        # Add essential function words for natural completions
        function_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
            'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must',
            'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
            'my', 'your', 'his', 'her', 'its', 'our', 'their',
            'currently', 'project', 'work', 'working', 'starting', 'development', 'ai', 'system',
            'now', 'today', 'new', 'current', 'main', 'primary', 'key', 'important', 'major'
        }
        
        words.update(function_words)
        return words

    @staticmethod
    def _apply_post_processing_guardrails(text: str, original_prompt: str, char_max: int) -> str:
        """
        Apply final guardrails: strip preambles, enforce length, ensure punctuation.
        (Expert Recommendation: Post-processing guardrails with hard truncation)
        """
        
        # Strip common AI preambles
        prefixes_to_remove = [
            "Enhanced prompt:", "Here's the enhanced prompt:", "Enhanced version:", 
            "Improved prompt:", "Here is the enhanced version:", "The enhanced prompt is:",
            "Completion:", "Enhanced completion:", "Result:", "Output:", "Response:"
        ]
        
        cleaned = text.strip()
        for prefix in prefixes_to_remove:
            if cleaned.lower().startswith(prefix.lower()):
                cleaned = cleaned[len(prefix):].strip()
        
        # Remove quotes if entire response is quoted
        if cleaned.startswith('"') and cleaned.endswith('"'):
            cleaned = cleaned[1:-1].strip()
        
        # Take only first line/sentence (single-line completions)
        cleaned = cleaned.splitlines()[0].strip()
        
        # Hard character limit with graceful truncation
        if len(cleaned) > char_max:
            cleaned = cleaned[:char_max].rstrip(",;:- ").rstrip()
            logger.info(f"🧹 GUARDRAIL: Hard-truncated to {char_max} chars")
        
        # Ensure it starts with original prompt (for completions)
        if not cleaned.lower().startswith(original_prompt.lower()):
            # Check if we can fit the original prompt + space + completion
            prefix_with_space = original_prompt + " "
            if len(prefix_with_space) + len(cleaned) <= char_max:
                cleaned = prefix_with_space + cleaned
            else:
                # If not enough space, just return original
                cleaned = original_prompt
        
        # Add period if missing and there's space (graceful punctuation)
        if not re.search(r"[.!?]$", cleaned) and len(cleaned) + 1 <= char_max:
            cleaned += "."
        
        return cleaned

__all__ = ["AsyncMemoryService"]
