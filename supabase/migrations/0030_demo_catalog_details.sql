-- T28 — Los catálogos de demo (Muebles Nogal, Plomería Garza) tenían título, precio y una foto
-- por ítem y nada más: la ficha de producto de la vitrina nueva quedaba casi vacía. Esta migración
-- agrega descripción y datos (medidas, material) a esos ítems, y lo hace sin reescribir las ~180
-- líneas de reset_demo_data (0020): la función original pasa a ser `_reset_demo_data_base` y la
-- pública, con la misma firma y los mismos permisos, la llama y luego enriquece por SKU.
alter function public.reset_demo_data(text) rename to _reset_demo_data_base;
revoke execute on function public._reset_demo_data_base(text) from public, anon, authenticated, service_role;

create or replace function public._demo_enrich_catalog()
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.items i
  set description = d.description, attrs = d.attrs::jsonb
  from public.tenants t,
  (values
    -- ===== Muebles Nogal (demo-catalogo) =====
    ('demo-catalogo', 'SOF-001', 'Sofá modular de tres módulos con chaise reversible. Estructura de pino secado en horno, asientos de espuma de alta densidad y tela antimanchas que se puede lavar.', '{"Medidas":"280 × 160 × 85 cm","Material":"Tela bouclé y pino","Entrega":"3 a 4 semanas"}'),
    ('demo-catalogo', 'SOF-002', 'Sillón de respaldo bajo y brazos amplios, tapizado en lino mezclado. Patas de fresno con acabado natural.', '{"Medidas":"82 × 85 × 78 cm","Material":"Lino y fresno","Entrega":"2 a 3 semanas"}'),
    ('demo-catalogo', 'SAL-003', 'Mesa de centro redonda con cubierta de roble macizo y base de acero negro mate. Se limpia con un paño húmedo.', '{"Medidas":"Ø 90 × 38 cm","Material":"Roble macizo y acero","Entrega":"2 a 3 semanas"}'),
    ('demo-catalogo', 'COM-001', 'Mesa rectangular de nogal con seis sillas tapizadas. El acabado en aceite natural se renueva con el tiempo en vez de descascararse.', '{"Medidas":"Mesa 180 × 90 × 76 cm","Material":"Nogal macizo","Incluye":"Mesa y 6 sillas"}'),
    ('demo-catalogo', 'COM-002', 'Mesa redonda de 120 cm con base central y cuatro sillas. Pensada para comedores chicos: cabe en 2.5 m de ancho.', '{"Medidas":"Ø 120 × 75 cm","Material":"Olivo y chapa de madera","Incluye":"Mesa y 4 sillas"}'),
    ('demo-catalogo', 'COM-003', 'Silla de respaldo curvo con asiento tapizado en tela de alto tráfico. Se vende por pieza.', '{"Medidas":"48 × 54 × 85 cm","Material":"Fresno y tela"}'),
    ('demo-catalogo', 'REC-001', 'Cama king size con cabecera tapizada y base de fresno con tablillas. No incluye colchón.', '{"Medidas":"Colchón king, 193 × 203 cm","Material":"Fresno y tela","Entrega":"3 a 4 semanas"}'),
    ('demo-catalogo', 'REC-002', 'Buró flotante de un cajón con guía de cierre suave. Se fija al muro con los herrajes incluidos.', '{"Medidas":"45 × 35 × 20 cm","Material":"Cedro"}'),
    ('demo-catalogo', 'REC-003', 'Cómoda de seis cajones con guías de cierre suave y asas empotradas. Acabado mate resistente al rayón.', '{"Medidas":"140 × 45 × 90 cm","Material":"Arce"}'),
    ('demo-catalogo', 'OFI-001', 'Escritorio de 160 cm con cajonera lateral y pasacables. Cubierta de encino con barniz mate.', '{"Medidas":"160 × 75 × 75 cm","Material":"Encino"}'),
    ('demo-catalogo', 'OFI-002', 'Librero abierto de cinco niveles con entrepaños ajustables. Soporta hasta 25 kg por nivel.', '{"Medidas":"90 × 30 × 180 cm","Material":"Pino"}'),
    ('demo-catalogo', 'OFI-003', 'Silla con soporte lumbar ajustable, respaldo de malla y brazos regulables. Ruedas aptas para piso duro.', '{"Material":"Malla y nylon","Garantía":"1 año"}'),
    ('demo-catalogo', 'SRV-001', 'Llevamos el mueble a tu domicilio en CDMX y zona conurbada, lo subimos y lo dejamos colocado. Agenda con dos días de anticipación.', '{"Cobertura":"CDMX y zona conurbada"}'),
    ('demo-catalogo', 'SRV-002', 'Armamos los muebles de la tienda en tu casa u oficina, con herramienta propia. El precio cubre hasta tres piezas.', '{"Incluye":"Hasta 3 piezas"}'),
    -- ===== Plomería Garza (demo-esencial) =====
    ('demo-esencial', 'PLO-001', 'Destapado de drenaje de cocina, baño o lavadero con herramienta mecánica. Incluye prueba de desalojo al terminar.', '{"Tiempo estimado":"1 a 2 horas"}'),
    ('demo-esencial', 'PLO-002', 'Localizamos y reparamos fugas en tubería empotrada. Incluye el resane básico del muro; el acabado final no está incluido.', '{"Tiempo estimado":"2 a 4 horas"}'),
    ('demo-esencial', 'PLO-003', 'Instalamos el calentador de paso con conexiones de gas y agua y verificamos que no haya fugas. El equipo se cotiza aparte.', '{"Tiempo estimado":"3 horas"}'),
    ('demo-esencial', 'PLO-004', 'Limpieza de serpentín, revisión del termostato y ajuste de flama. Recomendado cada 12 meses.', '{"Tiempo estimado":"1 hora"}'),
    ('demo-esencial', 'PLO-005', 'Retiramos la mezcladora anterior e instalamos la nueva con cinta y sellador. La mezcladora no está incluida.', '{"Tiempo estimado":"1 hora"}'),
    ('demo-esencial', 'PLO-006', 'Medimos la presión de la red y revisamos la tubería visible en busca de fugas o sarro. El costo se abona si contratas el servicio.', '{"Tiempo estimado":"45 minutos"}'),
    ('demo-esencial', 'PLO-007', 'Instalamos la bomba presurizadora con válvulas y tablero de arranque. Incluye prueba de presión en regaderas.', '{"Tiempo estimado":"4 horas"}'),
    ('demo-esencial', 'PLO-008', 'Vaciado, lavado y desinfección de cisterna de hasta 5,000 litros. Entregamos constancia del servicio.', '{"Tiempo estimado":"5 horas"}'),
    ('demo-esencial', 'PLO-009', 'Detección de fugas ocultas con geófono y cámara térmica, sin romper muros. Entregamos un reporte con la ubicación.', '{"Tiempo estimado":"2 horas"}'),
    ('demo-esencial', 'MAT-101', 'Válvula de esfera de latón de 1/2 pulgada, paso completo, para agua fría o caliente.', '{"Material":"Latón","Medida":"1/2 pulgada"}'),
    ('demo-esencial', 'MAT-102', 'Flotador de brazo con válvula de llenado para tinaco. Compatible con entrada de 1/2 pulgada.', '{"Medida":"1/2 pulgada"}'),
    ('demo-esencial', 'MAT-103', 'Mezcladora monomando de cromo para lavabo, con cartucho cerámico de 35 mm. Incluye mangueras de conexión.', '{"Acabado":"Cromo","Cartucho":"Cerámico de 35 mm"}')
  ) as d(slug, sku, description, attrs)
  where t.slug = d.slug and i.tenant_id = t.id and i.sku = d.sku;
end;
$$;
revoke execute on function public._demo_enrich_catalog() from public, anon, authenticated;

create or replace function public.reset_demo_data(p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._reset_demo_data_base(p_password);
  perform public._demo_enrich_catalog();
end;
$$;

revoke execute on function public.reset_demo_data(text) from public, anon, authenticated;
grant execute on function public.reset_demo_data(text) to service_role;

-- Aplica ya sobre los datos actuales (sin esperar al reset de las 3:00).
select public._demo_enrich_catalog();
