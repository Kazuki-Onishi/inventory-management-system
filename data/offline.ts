
import { Store, Item, Location, Stocktake, Category, Vendor } from '../types';

const stores: Store[] = [
    { id: 'demo-gion', name: 'Demo Store: Kyoto Gion' },
    { id: 'demo-shibuya', name: 'Demo Store: Tokyo Shibuya' },
];

const categories: Category[] = [
    { id: 'cat-coffee', name: 'Coffee & Beans' },
    { id: 'cat-beverages', name: 'Beverages' },
    { id: 'cat-desserts', name: 'Desserts' },
    { id: 'cat-food', name: 'Food' },
    { id: 'cat-supplies', name: 'Supplies' },
];

const vendors: Vendor[] = [
    {
        id: 'vendor-kyoto-roasters',
        name: 'Kyoto Roasters Inc.',
        contactName: 'Haruki Tanaka',
        internalContactName: 'Mai Nakamura',
        email: 'contact@kyotoroasters.jp',
        phone: '+81-75-000-0000',
        notes: 'Primary coffee supplier for Kyoto region stores.',
    },
    {
        id: 'vendor-brazil-farm',
        name: 'Brazil Farm Direct',
        contactName: 'Mariana Souza',
        internalContactName: 'Daichi Okada',
        email: 'sales@brazildirect.com',
        phone: '+55-11-1234-5678',
        notes: 'Direct import of specialty beans.',
    },
    {
        id: 'vendor-local-dairy',
        name: 'Shizuoka Dairy Cooperative',
        contactName: 'Kenji Sato',
        internalContactName: 'Aiko Fujimoto',
        email: 'support@shizuoka-dairy.jp',
        phone: '+81-54-222-1100',
        notes: 'Fresh dairy supplier with daily deliveries.',
    },
];

const items: Item[] = [
    // Standalone items
    { id: 'item-soysauce', name: 'しょうゆ(ボトル)', normalizedName: 'soy_sauce_bottle', shortName: 'しょうゆ', description: '1L', costA: 250, costB: 300, sku: 'SEAS-010', isDiscontinued: false, nameEn: 'Soy Sauce', janCode: '4901515123456', supplier: 'Kikkoman', categoryId: 'cat-food' },
    { id: 'item-water', name: 'ミネラルウォーター', normalizedName: 'mineral_water', shortName: '水', description: '500mlペットボトル', costA: 80, costB: 100, sku: 'BEV-001', isDiscontinued: false, nameEn: 'Mineral Water', categoryId: 'cat-beverages' },

    // Coffee Items
    { id: 'item-coffee-blend', name: 'コーヒー（オリジナルブレンド）', normalizedName: 'coffee_original_blend', shortName: 'オリブレ', description: '200gパック', costA: 450, costB: 500, sku: 'ITEM-001', isDiscontinued: false, nameEn: 'Coffee (Original Blend)', janCode: '4901234567890', supplier: 'Kyoto Roasters Inc.', categoryId: 'cat-coffee', vendorId: 'vendor-kyoto-roasters' },
    { id: 'item-beans-brazil', name: 'コーヒー豆（ブラジル）', normalizedName: 'coffee_beans_brazil', shortName: 'ブラジル豆', description: '1kg袋', costA: 1800, costB: 2000, sku: 'ITEM-002', isDiscontinued: false, nameEn: 'Coffee Beans (Brazil)', janCode: '4901234567891', supplier: 'Brazil Farm Direct', categoryId: 'cat-coffee', vendorId: 'vendor-brazil-farm' },
    { id: 'item-beans-ethiopia', name: 'コーヒー豆（エチオピア）', normalizedName: 'coffee_beans_ethiopia', shortName: 'エチオピア豆', description: '1kg袋', costA: 2200, costB: 2400, sku: 'ITEM-003', isDiscontinued: false, nameEn: 'Coffee Beans (Ethiopia)', categoryId: 'cat-coffee' },
    { id: 'item-beans-colombia', name: 'コーヒー豆（コロンビア）', normalizedName: 'coffee_beans_colombia', shortName: 'コロンビア豆', description: '1kg袋', costA: 2000, costB: 2200, sku: 'ITEM-004', isDiscontinued: true, nameEn: 'Coffee Beans (Colombia)', categoryId: 'cat-coffee' },


    // Pudding Items
    { id: 'item-pudding-white', name: 'プリン（白 - なめらかカスタード）', normalizedName: 'pudding_white', shortName: '白プリン', description: '', costA: 120, costB: 150, sku: 'DSRT-001', isDiscontinued: false, nameEn: 'Pudding (White - Custard)', categoryId: 'cat-desserts' },
    { id: 'item-pudding-black', name: 'プリン（黒 - 濃厚チョコレート）', normalizedName: 'pudding_black', shortName: '黒プリン', description: '', costA: 130, costB: 160, sku: 'DSRT-002', isDiscontinued: false, nameEn: 'Pudding (Black - Chocolate)', categoryId: 'cat-desserts' },

    // Juice Items
    { id: 'item-orange-juice', name: 'ジュース（オレンジ）', normalizedName: 'orange_juice', shortName: 'オレンジJ', description: '1Lパック', costA: 250, costB: 300, sku: 'BEV-002', isDiscontinued: false, nameEn: 'Juice (Orange)', categoryId: 'cat-beverages' },
    { id: 'item-apple-juice', name: 'ジュース（リンゴ）', normalizedName: 'apple_juice', shortName: 'リンゴJ', description: '1Lパック', costA: 250, costB: 300, sku: 'BEV-003', isDiscontinued: false, nameEn: 'Juice (Apple)', categoryId: 'cat-beverages' },

    // Tea Items
    { id: 'item-teabag', name: '紅茶（ティーバッグ）', normalizedName: 'black_tea_teabag', shortName: 'ティーバッグ', description: '50個入り', costA: 300, costB: 350, sku: 'BEV-005', isDiscontinued: false, nameEn: 'Tea Bags', categoryId: 'cat-beverages' },

    // Dairy Items
    { id: 'item-milk', name: '牛乳', normalizedName: 'milk', shortName: '牛乳', description: '1Lパック', costA: 180, costB: 220, sku: 'DAIRY-001', isDiscontinued: false, nameEn: 'Milk', supplier: 'Shizuoka Dairy Cooperative', categoryId: 'cat-beverages', vendorId: 'vendor-local-dairy' },

    // Sweeteners Items
    { id: 'item-sugar', name: 'シュガーポーション', normalizedName: 'sugar_portion', shortName: 'シュガー', description: '100個入り袋', costA: 400, costB: 450, sku: 'MISC-001', isDiscontinued: false, nameEn: 'Sugar Portion', categoryId: 'cat-supplies' },

    // Supplies Items
    { id: 'item-napkin', name: '紙ナプキン', normalizedName: 'paper_napkin', shortName: 'ナプキン', description: '200枚入り', costA: 150, costB: 180, sku: 'SUP-001', isDiscontinued: false, nameEn: 'Paper Napkin', categoryId: 'cat-supplies' },
    { id: 'item-cleaner', name: '業務用洗剤', normalizedName: 'commercial_cleaner', shortName: '洗剤', description: '5L', costA: 1500, costB: 1600, sku: 'SUP-002', isDiscontinued: false, nameEn: 'Commercial Cleaner', categoryId: 'cat-supplies' },

    // Bakery Items
    { id: 'item-croissant', name: 'クロワッサン（冷凍生地）', normalizedName: 'croissant', shortName: 'クロワッサン', description: '冷凍生地', costA: 80, costB: 100, sku: 'BAKE-001', isDiscontinued: false, nameEn: 'Croissant (Frozen)', categoryId: 'cat-food' },

    // Prepared Food Items
    { id: 'item-sandwich', name: 'たまごサンド', normalizedName: 'egg_sandwich', shortName: 'たまごサンド', description: '調理済み', costA: 200, costB: 250, sku: 'PREP-001', isDiscontinued: false, nameEn: 'Egg Sandwich', categoryId: 'cat-food' },
    
    // Dessert Items
    { id: 'item-cake-strawberry', name: 'いちごのショートケーキ（冷凍）', normalizedName: 'strawberry_shortcake', shortName: 'いちごケーキ', description: '冷凍', costA: 350, costB: 400, sku: 'DSRT-003', isDiscontinued: false, nameEn: 'Strawberry Shortcake (Frozen)', categoryId: 'cat-desserts' },

    // Syrup Items
    { id: 'item-syrup-vanilla', name: 'シロップ（バニラ）', normalizedName: 'vanilla_syrup', shortName: 'バニラシロップ', description: '750mlボトル', costA: 700, costB: 800, sku: 'SYRP-001', isDiscontinued: false, nameEn: 'Syrup (Vanilla)', categoryId: 'cat-beverages' },
];

const locations: Location[] = [
    // === Kyoto Gion Locations ===
    { 
        id: 'loc-gion-storage-3f', name: '3階壁面収納', humanId: 'A', description: '備品・乾物ストック', storeId: 'demo-gion',
        sublocations: [
            { id: 'loc-gion-storage-3f-a', humanId: '01', name: 'A上段', description: '軽いもの' },
            { id: 'loc-gion-storage-3f-b', humanId: '02', name: 'B中段', description: 'シロップ類' },
            { id: 'loc-gion-storage-3f-c', humanId: '03', name: 'C下段', description: '重いもの' },
        ]
    },
    { 
        id: 'loc-gion-fridge-1f', name: '1階冷蔵庫・冷凍庫（外側)', humanId: 'B', description: 'お客様用', storeId: 'demo-gion',
        sublocations: [
            { id: 'loc-gion-fridge-1f-a', humanId: '01', name: '冷蔵エリア', description: '' },
            { id: 'loc-gion-fridge-1f-b', humanId: '02', name: '冷凍エリア', description: 'アイス・冷凍ケーキ' },
        ]
    },
    { 
        id: 'loc-gion-register', name: 'レジ周り', humanId: 'C', description: '販売用小物', storeId: 'demo-gion',
        sublocations: [
            { id: 'loc-gion-register-a', humanId: '01', name: '前の棚A', description: 'コーヒー豆' },
            { id: 'loc-gion-register-b', humanId: '02', name: 'カウンター下', description: '袋、シュガー' },
        ]
    },
    { 
        id: 'loc-gion-kitchen-fridge', name: '厨房冷蔵庫', humanId: 'D', description: '調理用', storeId: 'demo-gion',
        sublocations: [
            { id: 'loc-gion-kitchen-fridge-a', humanId: '01', name: '上段', description: '乳製品' },
            { id: 'loc-gion-kitchen-fridge-b', humanId: '02', name: '下段', description: 'サンドイッチなど' },
        ]
    },
    {
        id: 'loc-gion-kitchen-pantry', name: '厨房パントリー', humanId: 'E', description: '', storeId: 'demo-gion',
        sublocations: []
    },

    // === Tokyo Shibuya Locations ===
    { 
        id: 'loc-shibuya-backyard', name: 'バックヤード', humanId: 'BK', description: '', storeId: 'demo-shibuya',
        sublocations: [
            { id: 'loc-shibuya-backyard-shelf-a', humanId: '01', name: '棚A', description: '飲料ストック' },
            { id: 'loc-shibuya-backyard-shelf-b', humanId: '02', name: '棚B', description: '乾物・コーヒー豆' },
            { id: 'loc-shibuya-backyard-shelf-c', humanId: '03', name: '棚C', description: '清掃用品・備品' },
            { id: 'loc-shibuya-backyard-freezer', humanId: '04', name: '冷凍ストッカー', description: '' },
        ] 
    },
    { 
        id: 'loc-shibuya-floor', name: '売り場', humanId: 'FL', description: '', storeId: 'demo-shibuya',
        sublocations: [
            { id: 'loc-shibuya-floor-fridge', humanId: '01', name: '飲料冷蔵庫', description: '' },
            { id: 'loc-shibuya-floor-shelf', humanId: '02', name: '商品棚', description: '焼き菓子など' },
            { id: 'loc-shibuya-floor-register', humanId: '03', name: 'レジ横', description: '販売用コーヒー豆' },
        ]
    },
     { 
        id: 'loc-shibuya-kitchen', name: '厨房', humanId: 'KT', description: '', storeId: 'demo-shibuya',
        sublocations: [
            { id: 'loc-shibuya-kitchen-fridge', humanId: '01', name: '冷蔵庫', description: '調理用食材' },
        ]
    },
];

const stocktakes: Stocktake[] = [
    // === Kyoto Gion Stocktakes ===
    { id: 'st-g-1', storeId: 'demo-gion', itemId: 'item-coffee-blend', locationId: 'loc-gion-register', subLocationId: 'loc-gion-register-a', lastCount: 12, lastCountedAt: '2023-10-26T10:00:00Z', description: 'ディスプレイ用' },
    { id: 'st-g-2', storeId: 'demo-gion', itemId: 'item-beans-brazil', locationId: 'loc-gion-kitchen-pantry', lastCount: 3, lastCountedAt: '2023-10-26T10:00:00Z' },
    { id: 'st-g-3', storeId: 'demo-gion', itemId: 'item-soysauce', locationId: 'loc-gion-kitchen-pantry', lastCount: 2, lastCountedAt: '2023-10-26T10:00:00Z' },
    { id: 'st-g-4', storeId: 'demo-gion', itemId: 'item-teabag', locationId: 'loc-gion-storage-3f', subLocationId: 'loc-gion-storage-3f-a', lastCount: 10, lastCountedAt: '2023-10-25T14:00:00Z' },
    { id: 'st-g-5', storeId: 'demo-gion', itemId: 'item-pudding-white', locationId: 'loc-gion-kitchen-fridge', subLocationId: 'loc-gion-kitchen-fridge-a', lastCount: 8, lastCountedAt: '2023-10-26T11:30:00Z' },
    { id: 'st-g-6', storeId: 'demo-gion', itemId: 'item-pudding-black', locationId: 'loc-gion-kitchen-fridge', subLocationId: 'loc-gion-kitchen-fridge-a', lastCount: 6, lastCountedAt: '2023-10-26T11:30:00Z' },
    { id: 'st-g-7', storeId: 'demo-gion', itemId: 'item-water', locationId: 'loc-gion-fridge-1f', subLocationId: 'loc-gion-fridge-1f-a', lastCount: 24, lastCountedAt: '2023-10-26T09:00:00Z' },
    { id: 'st-g-8', storeId: 'demo-gion', itemId: 'item-milk', locationId: 'loc-gion-kitchen-fridge', subLocationId: 'loc-gion-kitchen-fridge-a', lastCount: 5, lastCountedAt: '2023-10-27T08:00:00Z', description: '賞味期限確認' },
    { id: 'st-g-9', storeId: 'demo-gion', itemId: 'item-sugar', locationId: 'loc-gion-register', subLocationId: 'loc-gion-register-b', lastCount: 1, lastCountedAt: '2023-10-25T18:00:00Z' },
    { id: 'st-g-10', storeId: 'demo-gion', itemId: 'item-napkin', locationId: 'loc-gion-storage-3f', subLocationId: 'loc-gion-storage-3f-a', lastCount: 3, lastCountedAt: '2023-10-25T14:00:00Z' },
    { id: 'st-g-11', storeId: 'demo-gion', itemId: 'item-sandwich', locationId: 'loc-gion-kitchen-fridge', subLocationId: 'loc-gion-kitchen-fridge-b', lastCount: 10, lastCountedAt: '2023-10-27T08:00:00Z' },
    { id: 'st-g-12', storeId: 'demo-gion', itemId: 'item-cake-strawberry', locationId: 'loc-gion-fridge-1f', subLocationId: 'loc-gion-fridge-1f-b', lastCount: 7, lastCountedAt: '2023-10-26T11:30:00Z' },
    { id: 'st-g-13', storeId: 'demo-gion', itemId: 'item-syrup-vanilla', locationId: 'loc-gion-storage-3f', subLocationId: 'loc-gion-storage-3f-b', lastCount: 4, lastCountedAt: '2023-10-25T14:00:00Z' },

    // === Tokyo Shibuya Stocktakes ===
    { id: 'st-s-1', storeId: 'demo-shibuya', itemId: 'item-water', locationId: 'loc-shibuya-backyard', subLocationId: 'loc-shibuya-backyard-shelf-a', lastCount: 48, lastCountedAt: '2023-10-27T09:00:00Z' },
    { id: 'st-s-2', storeId: 'demo-shibuya', itemId: 'item-coffee-blend', locationId: 'loc-shibuya-backyard', subLocationId: 'loc-shibuya-backyard-shelf-b', lastCount: 20, lastCountedAt: '2023-10-27T09:00:00Z' },
    { id: 'st-s-3', storeId: 'demo-shibuya', itemId: 'item-water', locationId: 'loc-shibuya-floor', subLocationId: 'loc-shibuya-floor-fridge', lastCount: 15, lastCountedAt: '2023-10-27T09:00:00Z' },
    { id: 'st-s-4', storeId: 'demo-shibuya', itemId: 'item-orange-juice', locationId: 'loc-shibuya-floor', subLocationId: 'loc-shibuya-floor-fridge', lastCount: 10, lastCountedAt: '2023-10-27T09:00:00Z' },
    { id: 'st-s-5', storeId: 'demo-shibuya', itemId: 'item-apple-juice', locationId: 'loc-shibuya-floor', subLocationId: 'loc-shibuya-floor-fridge', lastCount: 11, lastCountedAt: '2023-10-27T09:00:00Z' },
    { id: 'st-s-6', storeId: 'demo-shibuya', itemId: 'item-beans-ethiopia', locationId: 'loc-shibuya-floor', subLocationId: 'loc-shibuya-floor-register', lastCount: 8, lastCountedAt: '2023-10-27T10:00:00Z', description: 'SALE対象' },
    { id: 'st-s-7', storeId: 'demo-shibuya', itemId: 'item-beans-ethiopia', locationId: 'loc-shibuya-backyard', subLocationId: 'loc-shibuya-backyard-shelf-b', lastCount: 5, lastCountedAt: '2023-10-27T09:00:00Z' },
    { id: 'st-s-8', storeId: 'demo-shibuya', itemId: 'item-croissant', locationId: 'loc-shibuya-backyard', subLocationId: 'loc-shibuya-backyard-freezer', lastCount: 30, lastCountedAt: '2023-10-27T09:15:00Z' },
    { id: 'st-s-9', storeId: 'demo-shibuya', itemId: 'item-milk', locationId: 'loc-shibuya-kitchen', subLocationId: 'loc-shibuya-kitchen-fridge', lastCount: 8, lastCountedAt: '2023-10-27T08:30:00Z' },
    { id: 'st-s-10', storeId: 'demo-shibuya', itemId: 'item-cleaner', locationId: 'loc-shibuya-backyard', subLocationId: 'loc-shibuya-backyard-shelf-c', lastCount: 2, lastCountedAt: '2023-10-26T15:00:00Z' },
    { id: 'st-s-11', storeId: 'demo-shibuya', itemId: 'item-napkin', locationId: 'loc-shibuya-backyard', subLocationId: 'loc-shibuya-backyard-shelf-c', lastCount: 10, lastCountedAt: '2023-10-26T15:00:00Z' },
];

export const OFFLINE_DATA = {
    stores,
    categories,
    vendors,
    items,
    locations,
    stocktakes,
};
