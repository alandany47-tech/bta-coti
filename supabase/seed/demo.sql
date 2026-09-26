-- Datos de demo (T26 lite): un tenant por modelo de suscripción y estado, con usuarios de prueba.
-- No se ejecuta a mano: `node scripts/seed-demo.mjs` sustituye __DEMO_PASSWORD__ y lo corre contra
-- el proyecto enlazado. Es idempotente: borra los tenants y usuarios demo y los vuelve a crear.
-- Generado a partir de los ejemplos personalizados por tenant; editar aquí directamente.

delete from public.tenants where slug in ('demo-esencial', 'demo-catalogo', 'demo-broker', 'demo-brokerpro', 'demo-prueba', 'demo-morosa', 'demo-suspendida', 'demo-cancelada');
delete from auth.users where email like '%@demo.ayx.test';


create function pg_temp.demo_user(p_email text, p_name text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('__DEMO_PASSWORD__', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name), now(), now(),
    '', '', '', '');
  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  return v_id;
end $$;

create function pg_temp.demo_image(p_slug text, p_n int) returns text language sql as $$
  select 'https://picsum.photos/seed/' || p_slug || '-' || p_n || '/1200/800';
$$;

-- Cotización congelada con los mismos campos que arma lib/quote-snapshot.ts (montos como pricing.ts).
create function pg_temp.demo_quote(p_tenant uuid, p_sku text, p_client text, p_discount numeric, p_down numeric,
  p_n int, p_final numeric, p_notes text, p_status text, p_views int, p_days_ago int, p_creator uuid) returns void language plpgsql as $$
declare
  i public.items; t public.tenants; c public.clients;
  v_id uuid := gen_random_uuid();
  v_eff numeric; v_disc numeric; v_dp numeric; v_bal numeric; v_fin numeric; v_inst numeric; v_mon numeric;
  v_at timestamptz := now() - make_interval(days => p_days_ago);
begin
  select * into i from public.items where tenant_id = p_tenant and sku = p_sku;
  select * into t from public.tenants where id = p_tenant;
  select * into c from public.clients where tenant_id = p_tenant and full_name = p_client;
  v_disc := i.price * p_discount / 100; v_eff := i.price - v_disc; v_dp := v_eff * p_down / 100;
  v_bal := v_eff - v_dp; v_fin := v_bal * p_final / 100; v_inst := v_bal - v_fin; v_mon := v_inst / p_n;
  insert into public.quotes (id, tenant_id, created_by, property_id, client_id, client_name, client_phone, discount_pct, down_payment_pct,
    down_payment_amount, installments_count, monthly_payment_amount, final_payment_amount, total_amount, notes, status, views,
    last_viewed_at, created_at, snapshot)
  values (v_id, p_tenant, p_creator, i.id, c.id, c.full_name, c.phone, p_discount, p_down, v_dp, p_n, v_mon, v_fin, v_eff, p_notes, p_status, p_views,
    case when p_views > 0 then v_at + interval '3 hours' end, v_at,
    jsonb_build_object('version', 1, 'quoteId', v_id, 'number', null, 'tenantName', t.name, 'tenantLogoUrl', t.logo_url, 'brandColor', t.brand_color,
      'advisorName', null, 'clientName', c.full_name, 'clientPhone', c.phone,
      'property', jsonb_build_object('id', i.id, 'tenant_id', i.tenant_id, 'title', i.title, 'unit_number', i.attrs ->> 'unit_number',
        'm2_interior', (i.attrs ->> 'm2_interior')::numeric, 'm2_exterior', (i.attrs ->> 'm2_exterior')::numeric, 'm2_total', (i.attrs ->> 'm2_total')::numeric,
        'parking_spaces', (i.attrs ->> 'parking')::numeric, 'list_price', i.price, 'images', to_jsonb(i.images[1:9]), 'floor_plan_url', i.floor_plan_url,
        'status', i.status, 'created_at', i.created_at, 'updated_at', i.updated_at),
      'breakdown', jsonb_build_object('effectivePrice', v_eff, 'discountAmount', v_disc, 'downPaymentAmount', v_dp, 'balanceAfterDownPayment', v_bal,
        'installmentsTotal', v_inst, 'monthlyPaymentAmount', v_mon, 'finalPaymentAmount', v_fin),
      'installmentsCount', p_n, 'notes', p_notes, 'createdAt', v_at));
end $$;


-- ===== Plomería Garza (demo-esencial): plan esencial, estado active =====
do $demo$
declare v_owner uuid; v_tenant uuid; v_user uuid;
begin
  v_owner := pg_temp.demo_user('owner.esencial@demo.ayx.test', 'Rafael Garza');
  v_tenant := public.provision_tenant(v_owner, 'Plomería Garza', 'demo-esencial', 'esencial', 'active', null, 'demo_clone', 'manual');
  update public.tenants set is_demo = true, brand_color = '#1f6f8b' where id = v_tenant;
  insert into public.clients (tenant_id, full_name, phone) values
    (v_tenant, 'Marisol Treviño', '8112340001'),
    (v_tenant, 'Hotel Sierra Madre', '8112340002'),
    (v_tenant, 'Panadería La Espiga', '8112340003'),
    (v_tenant, 'Ing. Luis Cantú', '8112340004');
  insert into public.items (tenant_id, kind, title, sku, price, unit, category, images, sort) values
    (v_tenant, 'service', 'Destapado de drenaje', 'PLO-001', 650, 'servicio', 'Plomería', array[pg_temp.demo_image('demo-esencial-PLO-001', 1)], 1),
    (v_tenant, 'service', 'Reparación de fuga en muro', 'PLO-002', 980, 'servicio', 'Plomería', array[pg_temp.demo_image('demo-esencial-PLO-002', 1)], 2),
    (v_tenant, 'service', 'Instalación de calentador de paso', 'PLO-003', 1450, 'servicio', 'Calentadores', array[pg_temp.demo_image('demo-esencial-PLO-003', 1)], 3),
    (v_tenant, 'service', 'Mantenimiento de boiler', 'PLO-004', 890, 'servicio', 'Calentadores', array[pg_temp.demo_image('demo-esencial-PLO-004', 1)], 4),
    (v_tenant, 'service', 'Cambio de mezcladora', 'PLO-005', 720, 'servicio', 'Plomería', array[pg_temp.demo_image('demo-esencial-PLO-005', 1)], 5),
    (v_tenant, 'service', 'Revisión de presión y tubería', 'PLO-006', 450, 'visita', 'Diagnóstico', array[pg_temp.demo_image('demo-esencial-PLO-006', 1)], 6),
    (v_tenant, 'service', 'Instalación de bomba presurizadora', 'PLO-007', 2300, 'servicio', 'Bombas', array[pg_temp.demo_image('demo-esencial-PLO-007', 1)], 7),
    (v_tenant, 'service', 'Limpieza de cisterna 5,000 L', 'PLO-008', 2600, 'servicio', 'Cisternas', array[pg_temp.demo_image('demo-esencial-PLO-008', 1)], 8),
    (v_tenant, 'service', 'Detección de fugas con equipo', 'PLO-009', 1800, 'servicio', 'Diagnóstico', array[pg_temp.demo_image('demo-esencial-PLO-009', 1)], 9),
    (v_tenant, 'product', 'Válvula de esfera 1/2" latón', 'MAT-101', 185, 'pieza', 'Materiales', array[pg_temp.demo_image('demo-esencial-MAT-101', 1)], 10),
    (v_tenant, 'product', 'Flotador para tinaco', 'MAT-102', 240, 'pieza', 'Materiales', array[pg_temp.demo_image('demo-esencial-MAT-102', 1)], 11),
    (v_tenant, 'product', 'Mezcladora monomando cromo', 'MAT-103', 1190, 'pieza', 'Materiales', array[pg_temp.demo_image('demo-esencial-MAT-103', 1)], 12);
end $demo$;

-- ===== Muebles Nogal (demo-catalogo): plan catalogo, estado active =====
do $demo$
declare v_owner uuid; v_tenant uuid; v_user uuid;
begin
  v_owner := pg_temp.demo_user('owner.catalogo@demo.ayx.test', 'Carolina Nogal');
  v_tenant := public.provision_tenant(v_owner, 'Muebles Nogal', 'demo-catalogo', 'catalogo', 'active', null, 'demo_clone', 'manual');
  update public.tenants set is_demo = true, brand_color = '#7a4b2a' where id = v_tenant;
  v_user := pg_temp.demo_user('editor.catalogo@demo.ayx.test', 'Iván Robles');
  insert into public.tenant_members (tenant_id, user_id, role) values (v_tenant, v_user, 'editor');
  insert into public.clients (tenant_id, full_name, phone) values
    (v_tenant, 'Estudio Ámbar Diseño', '5511220001'),
    (v_tenant, 'Daniela Ortega', '5511220002'),
    (v_tenant, 'Restaurante Fogón', '5511220003');
  insert into public.items (tenant_id, kind, title, sku, price, unit, category, images, sort) values
    (v_tenant, 'product', 'Sofá modular Bruma 3 piezas', 'SOF-001', 18900, 'pieza', 'Salas', array[pg_temp.demo_image('demo-catalogo-SOF-001', 1)], 1),
    (v_tenant, 'product', 'Sillón individual Costa', 'SOF-002', 7450, 'pieza', 'Salas', array[pg_temp.demo_image('demo-catalogo-SOF-002', 1)], 2),
    (v_tenant, 'product', 'Mesa de centro Roble', 'SAL-003', 3890, 'pieza', 'Salas', array[pg_temp.demo_image('demo-catalogo-SAL-003', 1)], 3),
    (v_tenant, 'product', 'Comedor Nogal 6 plazas', 'COM-001', 16500, 'juego', 'Comedores', array[pg_temp.demo_image('demo-catalogo-COM-001', 1)], 4),
    (v_tenant, 'product', 'Comedor redondo Olivo 4 plazas', 'COM-002', 11200, 'juego', 'Comedores', array[pg_temp.demo_image('demo-catalogo-COM-002', 1)], 5),
    (v_tenant, 'product', 'Silla Aspen tapizada', 'COM-003', 1690, 'pieza', 'Comedores', array[pg_temp.demo_image('demo-catalogo-COM-003', 1)], 6),
    (v_tenant, 'product', 'Cama King Fresno con cabecera', 'REC-001', 14900, 'pieza', 'Recámaras', array[pg_temp.demo_image('demo-catalogo-REC-001', 1)], 7),
    (v_tenant, 'product', 'Buró flotante Cedro', 'REC-002', 2350, 'pieza', 'Recámaras', array[pg_temp.demo_image('demo-catalogo-REC-002', 1)], 8),
    (v_tenant, 'product', 'Cómoda 6 cajones Arce', 'REC-003', 8990, 'pieza', 'Recámaras', array[pg_temp.demo_image('demo-catalogo-REC-003', 1)], 9),
    (v_tenant, 'product', 'Escritorio ejecutivo Encino', 'OFI-001', 9800, 'pieza', 'Oficina', array[pg_temp.demo_image('demo-catalogo-OFI-001', 1)], 10),
    (v_tenant, 'product', 'Librero abierto Pino', 'OFI-002', 5200, 'pieza', 'Oficina', array[pg_temp.demo_image('demo-catalogo-OFI-002', 1)], 11),
    (v_tenant, 'product', 'Silla de oficina ergonómica', 'OFI-003', 4300, 'pieza', 'Oficina', array[pg_temp.demo_image('demo-catalogo-OFI-003', 1)], 12),
    (v_tenant, 'service', 'Entrega e instalación en CDMX', 'SRV-001', 890, 'servicio', 'Servicios', array[pg_temp.demo_image('demo-catalogo-SRV-001', 1)], 13),
    (v_tenant, 'service', 'Armado a domicilio', 'SRV-002', 650, 'servicio', 'Servicios', array[pg_temp.demo_image('demo-catalogo-SRV-002', 1)], 14);
end $demo$;

-- ===== Residencial Almendro (demo-broker): plan broker, estado active =====
do $demo$
declare v_owner uuid; v_tenant uuid; v_user uuid;
begin
  v_owner := pg_temp.demo_user('owner.broker@demo.ayx.test', 'Andrea Almendro');
  v_tenant := public.provision_tenant(v_owner, 'Residencial Almendro', 'demo-broker', 'broker', 'active', null, 'demo_clone', 'manual');
  update public.tenants set is_demo = true, brand_color = '#2e6b4f' where id = v_tenant;
  v_user := pg_temp.demo_user('editor.broker@demo.ayx.test', 'Bruno Salas');
  insert into public.tenant_members (tenant_id, user_id, role) values (v_tenant, v_user, 'editor');
  v_user := pg_temp.demo_user('viewer.broker@demo.ayx.test', 'Camila Duarte');
  insert into public.tenant_members (tenant_id, user_id, role) values (v_tenant, v_user, 'viewer');
  insert into public.clients (tenant_id, full_name, phone) values
    (v_tenant, 'Alan de Pruebas', '5512340001'),
    (v_tenant, 'Familia Montoya', '5512340002'),
    (v_tenant, 'Lucía Fernández', '5512340003'),
    (v_tenant, 'Grupo Inversor Norte', '5512340004'),
    (v_tenant, 'Roberto Aguirre', '5512340005'),
    (v_tenant, 'Paola Vidal', '5512340006');
  insert into public.items (tenant_id, kind, title, sku, price, unit, category, attrs, status, images, sort) values
    (v_tenant, 'property', 'Departamento Jardín A-101', 'A-101', 2450000, 'unidad', 'Piso 1', jsonb_build_object('unit_number', 'A-101', 'm2_interior', 48, 'm2_exterior', 0, 'm2_total', 48, 'parking', 1, 'floor', 1), 'available', array[pg_temp.demo_image('demo-broker-A-101', 1), pg_temp.demo_image('demo-broker-A-101', 2), pg_temp.demo_image('demo-broker-A-101', 3)], 1),
    (v_tenant, 'property', 'Departamento Jardín A-102', 'A-102', 2590000, 'unidad', 'Piso 1', jsonb_build_object('unit_number', 'A-102', 'm2_interior', 52, 'm2_exterior', 0, 'm2_total', 52, 'parking', 1, 'floor', 1), 'available', array[pg_temp.demo_image('demo-broker-A-102', 1), pg_temp.demo_image('demo-broker-A-102', 2), pg_temp.demo_image('demo-broker-A-102', 3)], 2),
    (v_tenant, 'property', 'Departamento Terraza A-201', 'A-201', 3180000, 'unidad', 'Piso 2', jsonb_build_object('unit_number', 'A-201', 'm2_interior', 62, 'm2_exterior', 14, 'm2_total', 76, 'parking', 1, 'floor', 2), 'available', array[pg_temp.demo_image('demo-broker-A-201', 1), pg_temp.demo_image('demo-broker-A-201', 2), pg_temp.demo_image('demo-broker-A-201', 3)], 3),
    (v_tenant, 'property', 'Departamento Terraza A-202', 'A-202', 3350000, 'unidad', 'Piso 2', jsonb_build_object('unit_number', 'A-202', 'm2_interior', 65, 'm2_exterior', 14, 'm2_total', 79, 'parking', 2, 'floor', 2), 'reserved', array[pg_temp.demo_image('demo-broker-A-202', 1), pg_temp.demo_image('demo-broker-A-202', 2), pg_temp.demo_image('demo-broker-A-202', 3)], 4),
    (v_tenant, 'property', 'Departamento Familiar B-101', 'B-101', 4100000, 'unidad', 'Piso 1', jsonb_build_object('unit_number', 'B-101', 'm2_interior', 88, 'm2_exterior', 0, 'm2_total', 88, 'parking', 2, 'floor', 1), 'available', array[pg_temp.demo_image('demo-broker-B-101', 1), pg_temp.demo_image('demo-broker-B-101', 2), pg_temp.demo_image('demo-broker-B-101', 3)], 5),
    (v_tenant, 'property', 'Departamento Familiar B-102', 'B-102', 4250000, 'unidad', 'Piso 1', jsonb_build_object('unit_number', 'B-102', 'm2_interior', 90, 'm2_exterior', 0, 'm2_total', 90, 'parking', 2, 'floor', 1), 'sold', array[pg_temp.demo_image('demo-broker-B-102', 1), pg_temp.demo_image('demo-broker-B-102', 2), pg_temp.demo_image('demo-broker-B-102', 3)], 6),
    (v_tenant, 'property', 'Departamento Panorámico B-201', 'B-201', 5200000, 'unidad', 'Piso 2', jsonb_build_object('unit_number', 'B-201', 'm2_interior', 95, 'm2_exterior', 18, 'm2_total', 113, 'parking', 2, 'floor', 2), 'available', array[pg_temp.demo_image('demo-broker-B-201', 1), pg_temp.demo_image('demo-broker-B-201', 2), pg_temp.demo_image('demo-broker-B-201', 3)], 7),
    (v_tenant, 'property', 'Departamento Panorámico B-202', 'B-202', 5350000, 'unidad', 'Piso 2', jsonb_build_object('unit_number', 'B-202', 'm2_interior', 97, 'm2_exterior', 18, 'm2_total', 115, 'parking', 2, 'floor', 2), 'available', array[pg_temp.demo_image('demo-broker-B-202', 1), pg_temp.demo_image('demo-broker-B-202', 2), pg_temp.demo_image('demo-broker-B-202', 3)], 8),
    (v_tenant, 'property', 'Departamento Mirador B-301', 'B-301', 5980000, 'unidad', 'Piso 3', jsonb_build_object('unit_number', 'B-301', 'm2_interior', 102, 'm2_exterior', 20, 'm2_total', 122, 'parking', 2, 'floor', 3), 'reserved', array[pg_temp.demo_image('demo-broker-B-301', 1), pg_temp.demo_image('demo-broker-B-301', 2), pg_temp.demo_image('demo-broker-B-301', 3)], 9),
    (v_tenant, 'property', 'Loft Ejecutivo C-301', 'C-301', 3400000, 'unidad', 'Piso 3', jsonb_build_object('unit_number', 'C-301', 'm2_interior', 58, 'm2_exterior', 10, 'm2_total', 68, 'parking', 1, 'floor', 3), 'available', array[pg_temp.demo_image('demo-broker-C-301', 1), pg_temp.demo_image('demo-broker-C-301', 2), pg_temp.demo_image('demo-broker-C-301', 3)], 10),
    (v_tenant, 'property', 'Penthouse Almendro C-401', 'C-401', 9800000, 'unidad', 'Piso 4', jsonb_build_object('unit_number', 'C-401', 'm2_interior', 150, 'm2_exterior', 55, 'm2_total', 205, 'parking', 3, 'floor', 4), 'available', array[pg_temp.demo_image('demo-broker-C-401', 1), pg_temp.demo_image('demo-broker-C-401', 2), pg_temp.demo_image('demo-broker-C-401', 3)], 11),
    (v_tenant, 'property', 'Penthouse Almendro C-402', 'C-402', 10450000, 'unidad', 'Piso 4', jsonb_build_object('unit_number', 'C-402', 'm2_interior', 158, 'm2_exterior', 60, 'm2_total', 218, 'parking', 3, 'floor', 4), 'available', array[pg_temp.demo_image('demo-broker-C-402', 1), pg_temp.demo_image('demo-broker-C-402', 2), pg_temp.demo_image('demo-broker-C-402', 3)], 12);
  insert into public.items (tenant_id, kind, title, sku, price, unit, category, images, sort) values
    (v_tenant, 'service', 'Asesoría de crédito hipotecario', 'SRV-001', 0, 'servicio', 'Servicios', array[pg_temp.demo_image('demo-broker-SRV-001', 1)], 1),
    (v_tenant, 'service', 'Gestión de escrituración', 'SRV-002', 18000, 'servicio', 'Servicios', array[pg_temp.demo_image('demo-broker-SRV-002', 1)], 2),
    (v_tenant, 'service', 'Avalúo comercial', 'SRV-003', 6500, 'servicio', 'Servicios', array[pg_temp.demo_image('demo-broker-SRV-003', 1)], 3);
  perform pg_temp.demo_quote(v_tenant, 'A-201', 'Alan de Pruebas', 5, 20, 24, 0, 'Precio de preventa. Vigencia sujeta a disponibilidad.', 'viewed', 3, 2, v_owner);
  perform pg_temp.demo_quote(v_tenant, 'B-101', 'Familia Montoya', 0, 30, 18, 20, 'Incluye 2 cajones de estacionamiento.', 'accepted', 5, 6, v_owner);
  perform pg_temp.demo_quote(v_tenant, 'C-401', 'Grupo Inversor Norte', 8, 40, 12, 30, null, 'sent', 0, 1, v_owner);
  perform pg_temp.demo_quote(v_tenant, 'C-301', 'Lucía Fernández', 3, 25, 36, 0, 'Bono de mudanza incluido.', 'viewed', 2, 4, v_owner);
end $demo$;

-- ===== Grupo Vértice Inmobiliario (demo-brokerpro): plan broker_pro, estado active =====
do $demo$
declare v_owner uuid; v_tenant uuid; v_user uuid;
begin
  v_owner := pg_temp.demo_user('owner.brokerpro@demo.ayx.test', 'Emilio Vértice');
  v_tenant := public.provision_tenant(v_owner, 'Grupo Vértice Inmobiliario', 'demo-brokerpro', 'broker_pro', 'active', null, 'demo_clone', 'manual');
  update public.tenants set is_demo = true, brand_color = '#3b3f8f' where id = v_tenant;
  v_user := pg_temp.demo_user('editor.brokerpro@demo.ayx.test', 'Fernanda Ríos');
  insert into public.tenant_members (tenant_id, user_id, role) values (v_tenant, v_user, 'editor');
  insert into public.clients (tenant_id, full_name, phone) values
    (v_tenant, 'Corporativo Alfa', '8117770001'),
    (v_tenant, 'Sofía Lozano', '8117770002'),
    (v_tenant, 'Daniel y Karla Peña', '8117770003'),
    (v_tenant, 'Inversiones Sierra', '8117770004'),
    (v_tenant, 'Héctor Villarreal', '8117770005'),
    (v_tenant, 'Mariana Cavazos', '8117770006'),
    (v_tenant, 'Constructora Meridian', '8117770007'),
    (v_tenant, 'Jorge Espinoza', '8117770008');
  insert into public.items (tenant_id, kind, title, sku, price, unit, category, attrs, status, images, sort)
  select v_tenant, 'property', u.tipo || ' ' || u.code, u.code, u.price, 'unidad', 'Torre ' || u.torre,
    jsonb_build_object('unit_number', u.code, 'm2_interior', u.m2i, 'm2_exterior', u.m2e, 'm2_total', u.m2i + u.m2e, 'parking', u.park, 'floor', u.piso),
    u.status,
    array[pg_temp.demo_image('vertice-' || u.code, 1), pg_temp.demo_image('vertice-' || u.code, 2), pg_temp.demo_image('vertice-' || u.code, 3)], u.ord
  from (
    select n as ord, 'VRT-' || (100 * ((n - 1) / 6 + 1) + ((n - 1) % 6) + 1) as code,
      (array['Departamento','Departamento','Loft','Departamento','Penthouse','Departamento'])[(n - 1) % 6 + 1] as tipo,
      (array['Norte','Sur'])[(n - 1) % 2 + 1] as torre,
      (n - 1) / 6 + 1 as piso,
      (array[52,64,58,78,140,92])[(n - 1) % 6 + 1] as m2i,
      (array[0,10,12,14,45,18])[(n - 1) % 6 + 1] as m2e,
      (array[1,1,1,2,3,2])[(n - 1) % 6 + 1] as park,
      round((array[2350000,2980000,3150000,4300000,8900000,5100000])[(n - 1) % 6 + 1] * (1 + ((n - 1) / 6) * 0.035), -3) as price,
      case when n in (4, 13) then 'sold' when n in (9, 17, 22) then 'reserved' else 'available' end as status
    from generate_series(1, 24) n
  ) u;
  insert into public.items (tenant_id, kind, title, sku, price, unit, category, images, sort) values
    (v_tenant, 'service', 'Estudio de mercado por desarrollo', 'VER-001', 12000, 'servicio', 'Servicios', array[pg_temp.demo_image('demo-brokerpro-VER-001', 1)], 1),
    (v_tenant, 'service', 'Asesoría fiscal para inversionistas', 'VER-002', 7500, 'servicio', 'Servicios', array[pg_temp.demo_image('demo-brokerpro-VER-002', 1)], 2),
    (v_tenant, 'service', 'Home staging por unidad', 'VER-003', 9800, 'servicio', 'Servicios', array[pg_temp.demo_image('demo-brokerpro-VER-003', 1)], 3),
    (v_tenant, 'product', 'Paquete de fotografía y dron', 'VER-101', 4800, 'paquete', 'Marketing', array[pg_temp.demo_image('demo-brokerpro-VER-101', 1)], 4),
    (v_tenant, 'product', 'Recorrido virtual 360°', 'VER-102', 6200, 'paquete', 'Marketing', array[pg_temp.demo_image('demo-brokerpro-VER-102', 1)], 5),
    (v_tenant, 'product', 'Kit de señalización de obra', 'VER-103', 3500, 'pieza', 'Marketing', array[pg_temp.demo_image('demo-brokerpro-VER-103', 1)], 6);
  perform pg_temp.demo_quote(v_tenant, 'VRT-101', 'Corporativo Alfa', 10, 50, 12, 25, 'Compra de 2 unidades; se cotiza la primera.', 'accepted', 7, 10, v_owner);
  perform pg_temp.demo_quote(v_tenant, 'VRT-205', 'Sofía Lozano', 0, 20, 36, 0, null, 'viewed', 2, 3, v_owner);
  perform pg_temp.demo_quote(v_tenant, 'VRT-303', 'Daniel y Karla Peña', 5, 30, 24, 15, 'Enganche en dos exhibiciones.', 'viewed', 4, 5, v_owner);
  perform pg_temp.demo_quote(v_tenant, 'VRT-402', 'Inversiones Sierra', 12, 60, 6, 40, null, 'sent', 0, 1, v_owner);
  perform pg_temp.demo_quote(v_tenant, 'VRT-406', 'Héctor Villarreal', 0, 15, 48, 0, 'Cotización comparativa.', 'sent', 0, 0, v_owner);
  perform pg_temp.demo_quote(v_tenant, 'VRT-204', 'Mariana Cavazos', 7, 35, 18, 10, null, 'viewed', 1, 2, v_owner);
end $demo$;

-- ===== Casa Lomas Residencial (demo-prueba): plan broker, estado trialing =====
do $demo$
declare v_owner uuid; v_tenant uuid; v_user uuid;
begin
  v_owner := pg_temp.demo_user('owner.prueba@demo.ayx.test', 'Valeria Lomas');
  v_tenant := public.provision_tenant(v_owner, 'Casa Lomas Residencial', 'demo-prueba', 'broker', 'trialing', 7, 'demo_clone', 'manual');
  update public.tenants set is_demo = true, brand_color = '#b4532a' where id = v_tenant;
  insert into public.clients (tenant_id, full_name, phone) values
    (v_tenant, 'Pedro Landa', '3312000001'),
    (v_tenant, 'Ximena Cortés', '3312000002');
  insert into public.items (tenant_id, kind, title, sku, price, unit, category, attrs, status, images, sort) values
    (v_tenant, 'property', 'Casa Lomas 01', 'L-01', 7900000, 'unidad', 'Piso 1', jsonb_build_object('unit_number', 'L-01', 'm2_interior', 180, 'm2_exterior', 60, 'm2_total', 240, 'parking', 3, 'floor', 1), 'available', array[pg_temp.demo_image('demo-prueba-L-01', 1), pg_temp.demo_image('demo-prueba-L-01', 2), pg_temp.demo_image('demo-prueba-L-01', 3)], 1),
    (v_tenant, 'property', 'Casa Lomas 02', 'L-02', 8300000, 'unidad', 'Piso 1', jsonb_build_object('unit_number', 'L-02', 'm2_interior', 190, 'm2_exterior', 65, 'm2_total', 255, 'parking', 3, 'floor', 1), 'available', array[pg_temp.demo_image('demo-prueba-L-02', 1), pg_temp.demo_image('demo-prueba-L-02', 2), pg_temp.demo_image('demo-prueba-L-02', 3)], 2),
    (v_tenant, 'property', 'Casa Lomas 03', 'L-03', 8950000, 'unidad', 'Piso 1', jsonb_build_object('unit_number', 'L-03', 'm2_interior', 200, 'm2_exterior', 70, 'm2_total', 270, 'parking', 4, 'floor', 1), 'reserved', array[pg_temp.demo_image('demo-prueba-L-03', 1), pg_temp.demo_image('demo-prueba-L-03', 2), pg_temp.demo_image('demo-prueba-L-03', 3)], 3),
    (v_tenant, 'property', 'Casa Lomas 04', 'L-04', 8100000, 'unidad', 'Piso 1', jsonb_build_object('unit_number', 'L-04', 'm2_interior', 185, 'm2_exterior', 60, 'm2_total', 245, 'parking', 3, 'floor', 1), 'available', array[pg_temp.demo_image('demo-prueba-L-04', 1), pg_temp.demo_image('demo-prueba-L-04', 2), pg_temp.demo_image('demo-prueba-L-04', 3)], 4),
    (v_tenant, 'property', 'Casa Lomas 05', 'L-05', 9600000, 'unidad', 'Piso 1', jsonb_build_object('unit_number', 'L-05', 'm2_interior', 210, 'm2_exterior', 80, 'm2_total', 290, 'parking', 4, 'floor', 1), 'available', array[pg_temp.demo_image('demo-prueba-L-05', 1), pg_temp.demo_image('demo-prueba-L-05', 2), pg_temp.demo_image('demo-prueba-L-05', 3)], 5);
  perform pg_temp.demo_quote(v_tenant, 'L-02', 'Pedro Landa', 0, 30, 24, 0, 'Prueba gratuita: cotización de ejemplo.', 'viewed', 1, 1, v_owner);
end $demo$;

-- ===== Boutique Aurora (demo-morosa): plan catalogo, estado past_due =====
do $demo$
declare v_owner uuid; v_tenant uuid; v_user uuid;
begin
  v_owner := pg_temp.demo_user('owner.morosa@demo.ayx.test', 'Aurora Beltrán');
  v_tenant := public.provision_tenant(v_owner, 'Boutique Aurora', 'demo-morosa', 'catalogo', 'active', null, 'demo_clone', 'manual');
  update public.tenants set is_demo = true, brand_color = '#a86a12' where id = v_tenant;
  perform public.set_tenant_status(v_tenant, 'past_due', 'None', null);
  insert into public.clients (tenant_id, full_name, phone) values
    (v_tenant, 'Cliente Mostrador', '5544000001');
  insert into public.items (tenant_id, kind, title, sku, price, unit, category, images, sort) values
    (v_tenant, 'product', 'Vestido lino Marfil', 'VES-001', 1490, 'pieza', 'Vestidos', array[pg_temp.demo_image('demo-morosa-VES-001', 1)], 1),
    (v_tenant, 'product', 'Vestido seda Ébano', 'VES-002', 2390, 'pieza', 'Vestidos', array[pg_temp.demo_image('demo-morosa-VES-002', 1)], 2),
    (v_tenant, 'product', 'Blusa bordada Lila', 'BLU-001', 890, 'pieza', 'Blusas', array[pg_temp.demo_image('demo-morosa-BLU-001', 1)], 3),
    (v_tenant, 'product', 'Pantalón palazzo Arena', 'PAN-001', 1090, 'pieza', 'Pantalones', array[pg_temp.demo_image('demo-morosa-PAN-001', 1)], 4),
    (v_tenant, 'product', 'Bolso de piel Canela', 'ACC-001', 1890, 'pieza', 'Accesorios', array[pg_temp.demo_image('demo-morosa-ACC-001', 1)], 5),
    (v_tenant, 'product', 'Rebozo artesanal Turquesa', 'ACC-002', 1250, 'pieza', 'Accesorios', array[pg_temp.demo_image('demo-morosa-ACC-002', 1)], 6);
end $demo$;

-- ===== Taller Mecánico Rivas (demo-suspendida): plan esencial, estado suspended =====
do $demo$
declare v_owner uuid; v_tenant uuid; v_user uuid;
begin
  v_owner := pg_temp.demo_user('owner.suspendida@demo.ayx.test', 'Mateo Rivas');
  v_tenant := public.provision_tenant(v_owner, 'Taller Mecánico Rivas', 'demo-suspendida', 'esencial', 'active', null, 'demo_clone', 'manual');
  update public.tenants set is_demo = true, brand_color = '#b42318' where id = v_tenant;
  perform public.set_tenant_status(v_tenant, 'suspended', 'Demo: suspendido por falta de pago', null);
  insert into public.clients (tenant_id, full_name, phone) values
    (v_tenant, 'Flotilla Express', '8111000001');
  insert into public.items (tenant_id, kind, title, sku, price, unit, category, images, sort) values
    (v_tenant, 'service', 'Afinación mayor', 'TAL-001', 1850, 'servicio', 'Mantenimiento', array[pg_temp.demo_image('demo-suspendida-TAL-001', 1)], 1),
    (v_tenant, 'service', 'Cambio de frenos delanteros', 'TAL-002', 2400, 'servicio', 'Frenos', array[pg_temp.demo_image('demo-suspendida-TAL-002', 1)], 2),
    (v_tenant, 'service', 'Alineación y balanceo', 'TAL-003', 780, 'servicio', 'Llantas', array[pg_temp.demo_image('demo-suspendida-TAL-003', 1)], 3);
end $demo$;

-- ===== Inmobiliaria Sol Naciente (demo-cancelada): plan broker, estado canceled =====
do $demo$
declare v_owner uuid; v_tenant uuid; v_user uuid;
begin
  v_owner := pg_temp.demo_user('owner.cancelada@demo.ayx.test', 'Sara Naciente');
  v_tenant := public.provision_tenant(v_owner, 'Inmobiliaria Sol Naciente', 'demo-cancelada', 'broker', 'active', null, 'demo_clone', 'manual');
  update public.tenants set is_demo = true, brand_color = '#4a4843' where id = v_tenant;
  perform public.set_tenant_status(v_tenant, 'canceled', 'Demo: cliente canceló la suscripción', null);
  insert into public.clients (tenant_id, full_name, phone) values
    (v_tenant, 'Cliente Antiguo', '6641000001');
  insert into public.items (tenant_id, kind, title, sku, price, unit, category, attrs, status, images, sort) values
    (v_tenant, 'property', 'Departamento Sol 01', 'S-01', 3000000, 'unidad', 'Piso 1', jsonb_build_object('unit_number', 'S-01', 'm2_interior', 70, 'm2_exterior', 10, 'm2_total', 80, 'parking', 1, 'floor', 1), 'available', array[pg_temp.demo_image('demo-cancelada-S-01', 1), pg_temp.demo_image('demo-cancelada-S-01', 2), pg_temp.demo_image('demo-cancelada-S-01', 3)], 1);
end $demo$;
