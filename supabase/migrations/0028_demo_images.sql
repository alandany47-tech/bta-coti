-- T22 (seguimiento): las fotos de los tenants demo venían de picsum.photos/seed/<slug> —
-- aleatorias, sin relación con el producto (un departamento mostraba lo que cayera). Esta
-- migración reemplaza _demo_image (helper privado de reset_demo_data, 0020) por fotos reales
-- de Unsplash (CDN público, uso libre, CORS abierto — mismo patrón de hotlink que picsum)
-- elegidas por categoría: inmuebles/casas para los brokers, muebles por tipo de pieza para
-- Muebles Nogal, materiales/servicios de plomería para Plomería Garza, prendas específicas
-- para Boutique Aurora, frenos/llantas/motor para el taller. No cambia la firma de la función
-- (p_slug, p_n) para no tocar los ~90 call sites de 0020; solo cambia qué URL devuelve.
create or replace function public._demo_image(p_slug text, p_n int)
returns text
language plpgsql
as $$
declare
  pool text[];
  idx int;
begin
  pool := case
    -- ===== Boutique Aurora: una prenda real por SKU =====
    when p_slug = 'demo-morosa-ACC-001' then array['photo-1605733513597-a8f8341084e6']
    when p_slug = 'demo-morosa-ACC-002' then array['photo-1562869929-bda0650edb1f']
    when p_slug = 'demo-morosa-BLU-001' then array['photo-1790435236428-a8159a4c784d']
    when p_slug = 'demo-morosa-PAN-001' then array['photo-1610241532145-96771e5088e8']
    when p_slug = 'demo-morosa-VES-001' then array['photo-1578747522731-9e5a179b02f7']
    when p_slug = 'demo-morosa-VES-002' then array['photo-1764298493197-a1c1cce57800']

    -- ===== Plomería Garza: materiales y servicios por tipo =====
    when p_slug = 'demo-esencial-MAT-101' then array['photo-1761353855019-05f2f3ed9c43'] -- válvula/mezcladora
    when p_slug = 'demo-esencial-MAT-102' then array['photo-1530124566582-a618bc2615dc'] -- flotador/tubería
    when p_slug = 'demo-esencial-MAT-103' then array['photo-1773177930292-463ca3c5b86a'] -- mezcladora cromo
    when p_slug = 'demo-esencial-PLO-001' then array['photo-1588429717419-f328fe7fc260'] -- destapado
    when p_slug = 'demo-esencial-PLO-002' then array['photo-1660643630907-d0481ced7168'] -- fuga en muro
    when p_slug = 'demo-esencial-PLO-003' then array['photo-1594233078955-e1f73a02ebb2'] -- calentador de paso
    when p_slug = 'demo-esencial-PLO-004' then array['photo-1607965976464-5c4a9089598e'] -- mantenimiento boiler
    when p_slug = 'demo-esencial-PLO-005' then array['photo-1781004710903-035f7cedafb5'] -- cambio de mezcladora
    when p_slug = 'demo-esencial-PLO-006' then array['photo-1454988501794-2992f706932e'] -- presión y tubería
    when p_slug = 'demo-esencial-PLO-007' then array['photo-1639600993675-2281b2c939f0'] -- bomba presurizadora
    when p_slug = 'demo-esencial-PLO-008' then array['photo-1694674818352-f6061a0561a1'] -- cisterna
    when p_slug = 'demo-esencial-PLO-009' then array['photo-1503789146722-cf137a3c0fea'] -- detección de fugas

    -- ===== Muebles Nogal: por tipo de pieza =====
    when p_slug = 'demo-catalogo-COM-001' then array['photo-1487015307662-6ce6210680f1']
    when p_slug = 'demo-catalogo-COM-002' then array['photo-1636138388621-258a72ecb07e']
    when p_slug = 'demo-catalogo-COM-003' then array['photo-1583845112239-97ef1341b271']
    when p_slug = 'demo-catalogo-REC-001' then array['photo-1522771739844-6a9f6d5f14af']
    when p_slug = 'demo-catalogo-REC-002' then array['photo-1646572961739-58557003b037']
    when p_slug = 'demo-catalogo-REC-003' then array['photo-1582582621959-48d27397dc69']
    when p_slug = 'demo-catalogo-SAL-003' then array['photo-1560184897-67f4a3f9a7fa']
    when p_slug = 'demo-catalogo-SOF-001' then array['photo-1724582586580-8b52c02e99dd']
    when p_slug = 'demo-catalogo-SOF-002' then array['photo-1619911013257-8f1fbc919fc9']
    when p_slug = 'demo-catalogo-OFI-001' then array['photo-1704655295066-681e61ecca6b']
    when p_slug = 'demo-catalogo-OFI-002' then array['photo-1587136527307-f53f514267d7']
    when p_slug = 'demo-catalogo-OFI-003' then array['photo-1528208079124-a2387f039c99']
    when p_slug = 'demo-catalogo-SRV-001' then array['photo-1730154838368-c37b1fdebcf6'] -- entrega
    when p_slug = 'demo-catalogo-SRV-002' then array['photo-1624137527136-66e631bdaa0e'] -- armado

    -- ===== Taller Mecánico Rivas (TAL-001 afinación, TAL-002 frenos, TAL-003 alineación) =====
    when p_slug = 'demo-suspendida-TAL-001' then array['photo-1615906655593-ad0386982a0f'] -- afinación/motor
    when p_slug = 'demo-suspendida-TAL-002' then array['photo-1613214150384-14921ff659b2'] -- frenos
    when p_slug = 'demo-suspendida-TAL-003' then array['photo-1645445522156-9ac06bc7a767'] -- alineación/llantas

    -- ===== Residencial Almendro (demo-broker): más específico primero =====
    -- Servicios de broker (hipoteca, escrituración, avalúo) y de brokerpro (fiscal, estudio, staging)
    when p_slug like 'demo-broker-SRV-%' or p_slug like 'demo-brokerpro-VER-00%'
      then array['photo-1521791136064-7986c2920216', 'photo-1681505531034-8d67054e07f6', 'photo-1591453214154-c95db71dbd83']
    -- Penthouse/loft (más específico que el catch-all de departamentos de abajo)
    when p_slug in ('demo-broker-C-301', 'demo-broker-C-401', 'demo-broker-C-402')
      then array['photo-1565623833408-d77e39b88af6', 'photo-1503174971373-b1f69850bded', 'photo-1680416124510-5eae1beca412']
    -- Resto de departamentos Almendro (catch-all, debe ir al final del grupo demo-broker-%)
    when p_slug like 'demo-broker-%'
      then array['photo-1515263487990-61b07816b324', 'photo-1628592102751-ba83b0314276', 'photo-1613575831056-0acd5da8f085']

    -- Productos de marketing de brokerpro (dron, 360°, señalización)
    when p_slug like 'demo-brokerpro-VER-10%'
      then array['photo-1505843795480-5cfb3c03f6ff', 'photo-1656646499120-73b45218e56f', 'photo-1641441371947-47dd2f4a4276']

    -- Unidades de Grupo Vértice (24 deptos/lofts/penthouses: mismo acervo que Almendro + penthouse)
    when p_slug like 'vertice-%'
      then array['photo-1628592102751-ba83b0314276', 'photo-1613575831056-0acd5da8f085', 'photo-1565623833408-d77e39b88af6',
                  'photo-1503174971373-b1f69850bded', 'photo-1515263487990-61b07816b324', 'photo-1624204386084-dd8c05e32226']

    -- Inmobiliaria Sol Naciente (1 depto) y Casa Lomas Residencial (5 casas)
    when p_slug like 'demo-cancelada-%'
      then array['photo-1545324418-cc1a3fa10c00']
    when p_slug like 'demo-prueba-%'
      then array['photo-1660361338517-8c8fbb3ac264', 'photo-1696237583261-029171ee31fa', 'photo-1720442617080-c25f9955194c',
                  'photo-1704457030496-3463cf1b8650', 'photo-1762180075273-0527bdc7fa85']

    -- Respaldo: no debería alcanzarse con los SKUs reales del seed de hoy
    else array['photo-1486406146926-c627a92ad1ab']
  end;

  idx := 1 + (abs(hashtext(p_slug)) + p_n - 1) % greatest(array_length(pool, 1), 1);
  return 'https://images.unsplash.com/' || pool[idx] || '?w=1200&h=800&fit=crop&q=80';
end
$$;

revoke execute on function public._demo_image(text, int) from public, anon, authenticated;
