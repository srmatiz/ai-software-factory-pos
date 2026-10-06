# ADR 0003: Costo promedio ponderado y kardex

**Estado:** aceptada · 2026-10-06

## Contexto

El negocio necesita saber costos y utilidades por producto. Al cargar productos se registra el costo de adquisición; las compras posteriores pueden tener costos distintos.

## Decisión

- Costo promedio ponderado: `nuevoCosto = (stock × costo + cantidad × costoCompra) / (stock + cantidad)`; si el stock es ≤ 0, el costo de la compra pasa a ser el nuevo costo. Implementado en `weightedAverageCost` (`src/lib/money.ts`).
- `InventoryMovement` (kardex) registra cada entrada y salida con su costo unitario; `Product.stock` se actualiza en la misma transacción.
- `SaleItem.unitCost` congela el costo al momento de la venta.
- Dinero con `Decimal`, nunca float.

## Consecuencias

- Reportes de utilidad estables en el tiempo y auditables.
- Más simple que PEPS/FIFO; suficiente para comercio minorista pequeño.
