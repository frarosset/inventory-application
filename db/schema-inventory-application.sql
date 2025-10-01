--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: doughs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doughs (
    id integer NOT NULL,
    name character varying(40) NOT NULL,
    is_protected boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone,
    notes character varying(500),
    price numeric DEFAULT 1 NOT NULL,
    stock integer DEFAULT 100 NOT NULL,
    last_used_at timestamp with time zone,
    last_restocked_at timestamp with time zone,
    CONSTRAINT doughs_price_check CHECK (((price >= (0)::numeric) AND (price <= (1000)::numeric))),
    CONSTRAINT doughs_stock_check CHECK (((stock >= 0) AND (stock <= 100000)))
);


--
-- Name: base_dough; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.base_dough AS
 SELECT id,
    name,
    is_protected,
    created_at,
    updated_at,
    notes,
    price,
    stock,
    last_used_at,
    last_restocked_at
   FROM public.doughs
  WHERE (id = 1);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(40) NOT NULL,
    is_protected boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone,
    notes character varying(500)
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.categories ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pizzas_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizzas_categories (
    pizza_id integer NOT NULL,
    category_id integer NOT NULL
);


--
-- Name: categories_names_per_pizza; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.categories_names_per_pizza AS
 SELECT pc.pizza_id,
    COALESCE(json_agg(c.name ORDER BY pc.category_id), '[]'::json) AS categories
   FROM (public.pizzas_categories pc
     LEFT JOIN public.categories c ON ((pc.category_id = c.id)))
  GROUP BY pc.pizza_id
  ORDER BY pc.pizza_id;


--
-- Name: ingredients_categories_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredients_categories_rules (
    ingredient_id integer NOT NULL,
    category_id integer NOT NULL,
    rule_type character varying(30) NOT NULL,
    CONSTRAINT ingredients_categories_rules_rule_type_check CHECK (((rule_type)::text = ANY ((ARRAY['enforcing'::character varying, 'incompatible'::character varying])::text[])))
);


--
-- Name: pizzas_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizzas_ingredients (
    pizza_id integer NOT NULL,
    ingredient_id integer NOT NULL
);


--
-- Name: pizzas_categories_rules; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pizzas_categories_rules AS
 SELECT DISTINCT pi.pizza_id,
    ci.category_id,
    ci.rule_type
   FROM (public.pizzas_ingredients pi
     JOIN public.ingredients_categories_rules ci ON ((pi.ingredient_id = ci.ingredient_id)));


--
-- Name: pizzas_actual_categories; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pizzas_actual_categories AS
 SELECT pizza_id,
    category_id AS actual_category_id
   FROM ((
                 SELECT pizzas_categories_rules.pizza_id,
                    pizzas_categories_rules.category_id
                   FROM public.pizzas_categories_rules
                  WHERE ((pizzas_categories_rules.rule_type)::text = 'enforcing'::text)
                UNION
                 SELECT pizzas_categories.pizza_id,
                    pizzas_categories.category_id
                   FROM public.pizzas_categories
        ) EXCEPT
         SELECT pizzas_categories_rules.pizza_id,
            pizzas_categories_rules.category_id
           FROM public.pizzas_categories_rules
          WHERE ((pizzas_categories_rules.rule_type)::text = 'incompatible'::text)) unnamed_subquery;


--
-- Name: categories_per_pizza; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.categories_per_pizza AS
 SELECT COALESCE(pac_c.pizza_id, pc_c.pizza_id, pcr_c.pizza_id) AS pizza_id,
    COALESCE(pac_c.actual_categories, '[]'::json) AS actual_categories,
    COALESCE(pc_c.categories, '[]'::json) AS categories,
    COALESCE(pcr_c.enforced_categories, '[]'::json) AS enforced_categories,
    COALESCE(pcr_c.incompatible_categories, '[]'::json) AS incompatible_categories
   FROM ((( SELECT pac.pizza_id,
            COALESCE(json_agg(json_build_object('id', pac.actual_category_id, 'name', c.name) ORDER BY pac.actual_category_id), '[]'::json) AS actual_categories
           FROM (public.pizzas_actual_categories pac
             LEFT JOIN public.categories c ON ((pac.actual_category_id = c.id)))
          GROUP BY pac.pizza_id) pac_c
     FULL JOIN ( SELECT pc.pizza_id,
            COALESCE(json_agg(json_build_object('id', pc.category_id, 'name', c.name) ORDER BY pc.category_id), '[]'::json) AS categories
           FROM (public.pizzas_categories pc
             LEFT JOIN public.categories c ON ((pc.category_id = c.id)))
          GROUP BY pc.pizza_id) pc_c USING (pizza_id))
     FULL JOIN ( SELECT pc.pizza_id,
            COALESCE(json_agg(json_build_object('id', pc.category_id, 'name', c.name) ORDER BY pc.category_id) FILTER (WHERE ((pc.rule_type)::text = 'enforcing'::text)), '[]'::json) AS enforced_categories,
            COALESCE(json_agg(json_build_object('id', pc.category_id, 'name', c.name) ORDER BY pc.category_id) FILTER (WHERE ((pc.rule_type)::text = 'incompatible'::text)), '[]'::json) AS incompatible_categories
           FROM (public.pizzas_categories_rules pc
             LEFT JOIN public.categories c ON ((pc.category_id = c.id)))
          GROUP BY pc.pizza_id) pcr_c USING (pizza_id))
  ORDER BY COALESCE(pac_c.pizza_id, pc_c.pizza_id, pcr_c.pizza_id);


--
-- Name: category_names_rules_per_ingredient; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.category_names_rules_per_ingredient AS
 SELECT ic.ingredient_id,
    COALESCE(json_agg(c.name ORDER BY ic.category_id) FILTER (WHERE ((ic.rule_type)::text = 'enforcing'::text)), '[]'::json) AS enforced_categories,
    COALESCE(json_agg(c.name ORDER BY ic.category_id) FILTER (WHERE ((ic.rule_type)::text = 'incompatible'::text)), '[]'::json) AS incompatible_categories
   FROM (public.ingredients_categories_rules ic
     LEFT JOIN public.categories c ON ((ic.category_id = c.id)))
  GROUP BY ic.ingredient_id
  ORDER BY ic.ingredient_id;


--
-- Name: category_rules_per_ingredient; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.category_rules_per_ingredient AS
 SELECT ic.ingredient_id,
    COALESCE(json_agg(json_build_object('id', ic.category_id, 'name', c.name) ORDER BY ic.category_id) FILTER (WHERE ((ic.rule_type)::text = 'enforcing'::text)), '[]'::json) AS enforced_categories,
    COALESCE(json_agg(json_build_object('id', ic.category_id, 'name', c.name) ORDER BY ic.category_id) FILTER (WHERE ((ic.rule_type)::text = 'incompatible'::text)), '[]'::json) AS incompatible_categories
   FROM (public.ingredients_categories_rules ic
     LEFT JOIN public.categories c ON ((ic.category_id = c.id)))
  GROUP BY ic.ingredient_id
  ORDER BY ic.ingredient_id;


--
-- Name: doughs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.doughs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.doughs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredients (
    id integer NOT NULL,
    name character varying(40) NOT NULL,
    is_protected boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone,
    notes character varying(500),
    price numeric DEFAULT 1 NOT NULL,
    stock integer DEFAULT 100 NOT NULL,
    last_used_at timestamp with time zone,
    last_restocked_at timestamp with time zone,
    CONSTRAINT ingredients_price_check CHECK (((price >= (0)::numeric) AND (price <= (1000)::numeric))),
    CONSTRAINT ingredients_stock_check CHECK (((stock >= 0) AND (stock <= 100000)))
);


--
-- Name: ingredient_names_rules_per_category; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ingredient_names_rules_per_category AS
 SELECT ic.category_id,
    COALESCE(json_agg(i.name ORDER BY ic.ingredient_id) FILTER (WHERE ((ic.rule_type)::text = 'enforcing'::text)), '[]'::json) AS enforcing_ingredients,
    COALESCE(json_agg(i.name ORDER BY ic.ingredient_id) FILTER (WHERE ((ic.rule_type)::text = 'incompatible'::text)), '[]'::json) AS incompatible_ingredients
   FROM (public.ingredients_categories_rules ic
     LEFT JOIN public.ingredients i ON ((ic.ingredient_id = i.id)))
  GROUP BY ic.category_id
  ORDER BY ic.category_id;


--
-- Name: ingredient_rules_per_category; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ingredient_rules_per_category AS
 SELECT ic.category_id,
    COALESCE(json_agg(json_build_object('id', ic.ingredient_id, 'name', i.name) ORDER BY ic.ingredient_id) FILTER (WHERE ((ic.rule_type)::text = 'enforcing'::text)), '[]'::json) AS enforcing_ingredients,
    COALESCE(json_agg(json_build_object('id', ic.ingredient_id, 'name', i.name) ORDER BY ic.ingredient_id) FILTER (WHERE ((ic.rule_type)::text = 'incompatible'::text)), '[]'::json) AS incompatible_ingredients
   FROM (public.ingredients_categories_rules ic
     LEFT JOIN public.ingredients i ON ((ic.ingredient_id = i.id)))
  GROUP BY ic.category_id
  ORDER BY ic.category_id;


--
-- Name: ingredients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.ingredients ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ingredients_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ingredients_names_per_pizza; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ingredients_names_per_pizza AS
 SELECT pi.pizza_id,
    COALESCE(json_agg(i.name ORDER BY pi.ingredient_id), '[]'::json) AS ingredients
   FROM (public.pizzas_ingredients pi
     LEFT JOIN public.ingredients i ON ((pi.ingredient_id = i.id)))
  GROUP BY pi.pizza_id
  ORDER BY pi.pizza_id;


--
-- Name: ingredients_per_pizza; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ingredients_per_pizza AS
 SELECT pi.pizza_id,
    COALESCE(json_agg(json_build_object('id', pi.ingredient_id, 'name', i.name, 'price', i.price, 'stock', i.stock) ORDER BY pi.ingredient_id), '[]'::json) AS ingredients,
    sum(i.price) AS ingredients_total_cost,
    min(i.stock) AS ingredients_availability
   FROM (public.pizzas_ingredients pi
     LEFT JOIN public.ingredients i ON ((pi.ingredient_id = i.id)))
  GROUP BY pi.pizza_id
  ORDER BY pi.pizza_id;


--
-- Name: pizzas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizzas (
    id integer NOT NULL,
    name character varying(40) NOT NULL,
    is_protected boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone,
    notes character varying(500),
    last_ordered_at timestamp with time zone
);


--
-- Name: pizzas_brief; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pizzas_brief AS
 SELECT p.id,
    p.name,
    p.is_protected,
    COALESCE(ip.ingredients, '[]'::json) AS ingredients,
    (COALESCE(ip.ingredients_total_cost, (0)::numeric) + d.price) AS cost,
    LEAST(COALESCE(ip.ingredients_availability, d.stock), d.stock) AS availability,
    COALESCE(cp.actual_categories, '[]'::json) AS actual_categories
   FROM (((public.pizzas p
     LEFT JOIN public.ingredients_per_pizza ip ON ((p.id = ip.pizza_id)))
     LEFT JOIN public.categories_per_pizza cp ON ((p.id = cp.pizza_id)))
     JOIN public.base_dough d ON (true))
  ORDER BY p.id;


--
-- Name: pizzas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.pizzas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.pizzas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pizzas_names_per_category; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pizzas_names_per_category AS
 SELECT pc.category_id,
    COALESCE(json_agg(p.name ORDER BY p.id), '[]'::json) AS pizzas,
    COALESCE(json_agg(p.name ORDER BY p.id) FILTER (WHERE p.is_protected), '[]'::json) AS protected_pizzas
   FROM ((public.pizzas_categories pc
     LEFT JOIN public.pizzas p ON ((pc.pizza_id = p.id)))
     LEFT JOIN public.categories c ON ((pc.category_id = c.id)))
  GROUP BY pc.category_id
  ORDER BY pc.category_id;


--
-- Name: pizzas_names_per_ingredient; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pizzas_names_per_ingredient AS
 SELECT pi.ingredient_id,
    COALESCE(json_agg(p.name ORDER BY pi.pizza_id), '[]'::json) AS pizzas,
    COALESCE(json_agg(p.name ORDER BY p.id) FILTER (WHERE p.is_protected), '[]'::json) AS protected_pizzas
   FROM ((public.pizzas_ingredients pi
     LEFT JOIN public.pizzas p ON ((pi.pizza_id = p.id)))
     LEFT JOIN public.ingredients i ON ((pi.ingredient_id = i.id)))
  GROUP BY pi.ingredient_id
  ORDER BY pi.ingredient_id;


--
-- Name: pizzas_per_category; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pizzas_per_category AS
 SELECT COALESCE(pac_p.category_id, pc_p.category_id, pcr_c.category_id) AS category_id,
    COALESCE(pac_p.actual_for_pizzas, '[]'::json) AS actual_for_pizzas,
    COALESCE(pc_p.pizzas, '[]'::json) AS pizzas,
    COALESCE(pcr_c.enforced_in_pizzas, '[]'::json) AS enforced_in_pizzas,
    COALESCE(pcr_c.incompatible_with_pizzas, '[]'::json) AS incompatible_with_pizzas
   FROM ((( SELECT pac.actual_category_id AS category_id,
            COALESCE(json_agg(p.* ORDER BY p.id), '[]'::json) AS actual_for_pizzas
           FROM (public.pizzas_actual_categories pac
             LEFT JOIN public.pizzas_brief p ON ((pac.pizza_id = p.id)))
          GROUP BY pac.actual_category_id) pac_p
     FULL JOIN ( SELECT pc.category_id,
            COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.id), '[]'::json) AS pizzas
           FROM (public.pizzas_categories pc
             LEFT JOIN public.pizzas p ON ((pc.pizza_id = p.id)))
          GROUP BY pc.category_id) pc_p USING (category_id))
     FULL JOIN ( SELECT pc.category_id,
            COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.id) FILTER (WHERE ((pc.rule_type)::text = 'enforcing'::text)), '[]'::json) AS enforced_in_pizzas,
            COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name) ORDER BY p.id) FILTER (WHERE ((pc.rule_type)::text = 'incompatible'::text)), '[]'::json) AS incompatible_with_pizzas
           FROM (public.pizzas_categories_rules pc
             LEFT JOIN public.pizzas p ON ((pc.pizza_id = p.id)))
          GROUP BY pc.category_id) pcr_c USING (category_id))
  ORDER BY COALESCE(pac_p.category_id, pc_p.category_id, pcr_c.category_id);


--
-- Name: pizzas_per_ingredient; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pizzas_per_ingredient AS
 SELECT pi.ingredient_id,
    COALESCE(json_agg(p.* ORDER BY p.id), '[]'::json) AS pizzas
   FROM (public.pizzas_ingredients pi
     LEFT JOIN public.pizzas_brief p ON ((pi.pizza_id = p.id)))
  GROUP BY pi.ingredient_id
  ORDER BY pi.ingredient_id;


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: doughs doughs_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doughs
    ADD CONSTRAINT doughs_name_key UNIQUE (name);


--
-- Name: doughs doughs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doughs
    ADD CONSTRAINT doughs_pkey PRIMARY KEY (id);


--
-- Name: ingredients ingredients_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_name_key UNIQUE (name);


--
-- Name: ingredients ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);


--
-- Name: pizzas pizzas_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizzas
    ADD CONSTRAINT pizzas_name_key UNIQUE (name);


--
-- Name: pizzas pizzas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizzas
    ADD CONSTRAINT pizzas_pkey PRIMARY KEY (id);


--
-- Name: ingredients_categories_rules u_ingredient_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients_categories_rules
    ADD CONSTRAINT u_ingredient_category UNIQUE (ingredient_id, category_id);


--
-- Name: pizzas_categories u_pizza_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizzas_categories
    ADD CONSTRAINT u_pizza_category UNIQUE (pizza_id, category_id);


--
-- Name: pizzas_ingredients u_pizza_ingredient; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizzas_ingredients
    ADD CONSTRAINT u_pizza_ingredient UNIQUE (pizza_id, ingredient_id);


--
-- Name: ingredients_categories_rules ingredients_categories_rules_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients_categories_rules
    ADD CONSTRAINT ingredients_categories_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: ingredients_categories_rules ingredients_categories_rules_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients_categories_rules
    ADD CONSTRAINT ingredients_categories_rules_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: pizzas_categories pizzas_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizzas_categories
    ADD CONSTRAINT pizzas_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: pizzas_categories pizzas_categories_pizza_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizzas_categories
    ADD CONSTRAINT pizzas_categories_pizza_id_fkey FOREIGN KEY (pizza_id) REFERENCES public.pizzas(id);


--
-- Name: pizzas_ingredients pizzas_ingredients_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizzas_ingredients
    ADD CONSTRAINT pizzas_ingredients_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: pizzas_ingredients pizzas_ingredients_pizza_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pizzas_ingredients
    ADD CONSTRAINT pizzas_ingredients_pizza_id_fkey FOREIGN KEY (pizza_id) REFERENCES public.pizzas(id);


--
-- PostgreSQL database dump complete
--

