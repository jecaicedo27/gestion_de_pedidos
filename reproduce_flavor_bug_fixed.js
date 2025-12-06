
const extractFlavor = (productName) => {
    const upperName = productName.toUpperCase();
    const normalized = upperName
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
        .replace(/\s+/g, ' ') // colapsar espacios
        .trim();

    // Regla específica: priorizar "LIMA LIMON" sobre "LIMON"
    if (
        normalized.includes('LIMA LIMON') ||
        normalized.includes('LIMA-LIMON') ||
        normalized.includes('LIMA/LIMON')
    ) {
        return 'LIMA LIMON';
    }

    // 1) Sabores comunes (UPDATED ORDER)
    const commonFlavors = [
        'BLUEBERRY', 'CAFE', 'CEREZA', 'CHAMOY', 'CHICLE', 'COCO', 'FRESA',
        'ICE PINK', 'LYCHE', 'MANGO BICHE CON SAL', 'MANGO BICHE', 'MANZANA VERDE',
        'MARACUYA', 'SANDIA',
        // Adicionales frecuentes
        'VAINILLA', 'VANILLA', 'UVA', 'LIMA LIMON', 'LIMON', 'NARANJA', 'PIÑA', 'MENTA', 'CHOCOLATE'
    ];

    for (const flavor of commonFlavors) {
        if (normalized.includes(flavor)) {
            return flavor;
        }
    }

    return 'UNKNOWN';
};

console.log("Testing 'LIQUIPOPS MANGO BICHE CON SAL 350G':", extractFlavor('LIQUIPOPS MANGO BICHE CON SAL 350G'));
console.log("Testing 'LIQUIPOPS MANGO BICHE 350G':", extractFlavor('LIQUIPOPS MANGO BICHE 350G'));
