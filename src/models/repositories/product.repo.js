"use strict";

const product = require("../product.model");
const { Types } = require("mongoose");
const {
  getSelectData,
  getUnselectData,
  convertToObjectIdMongodb,
} = require("../../utils/index");
const CategoryService = require("../../services/category.service");
const { isEmpty } = require("lodash");

const queryProduct = async ({ query, limit, skip }) => {
  return await product
    .find(query)
    .populate("shop", "name email -_id")
    .sort({ updateAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean()
    .exec();
};

const findOneProduct = async ({ productId, unSelect }) => {
  return await product
    .findById(productId)
    .select(getUnselectData(unSelect))
    .exec();
};

const findAllProducts = async ({ limit, page, filter, sort, select }) => {
  const skip = limit * (page - 1);
  const sortBy = sort === "ctime" ? { _id: -1 } : { _id: 1 };
  console.log("select:: ", select);
  const products = await product
    .find(filter)
    .sort(sortBy)
    .skip(skip)
    .limit(limit)
    .select(getSelectData(select))
    .lean()
    .exec();
  return products;
};

const findAllProductsForUser = async ({
  minPrice,
  maxPrice,
  limit,
  name,
  shop,
  page,
  filter,
  sort,
  typeId,
  select,
}) => {
  const skip = limit * (page - 1);
  const sortBy = sort === "ctime" ? { _id: -1 } : { _id: 1 };
  let listTypeId = [];

  console.log("filter:: ", filter);

  let productFilter = {
    isPublished: true,
    minPrice: {
      $gte: minPrice ? parseInt(minPrice) : -1,
      $lte: maxPrice ? parseInt(maxPrice) : 10e9,
    },
  };

  if (!isEmpty(filter)) {
    productFilter = { ...filter, ...productFilter };
  }
  if (!isEmpty(typeId)) {
    const category = await CategoryService.getCategoryById(typeId);
    category.subTypes.forEach((item) => {
      listTypeId.push(item._id);
    });

    productFilter.typeId = { $in: listTypeId };
  }

  if (!isEmpty(name)) {
    const regexSearch = new RegExp(name);
    productFilter.name = { $regex: regexSearch, $options: "i" };
  }

  if (shop) {
    productFilter = { ...productFilter, shop: convertToObjectIdMongodb(shop) };
  }

  console.log("productFilter:: ", productFilter);

  const [products, count] = await Promise.all([
    product
      .aggregate([
        { $match: productFilter },
        // {
        //   $lookup: {
        //     from: "variation",
        //     let: { variations: "$variations" },
        //     pipeline: [
        //       {
        //         $match: {
        //           $expr: { $in: ["$_id", "$$variations"] },
        //         },
        //       },
        //       {
        //         $project: variationProjection,
        //       },
        //     ],
        //     as: "variations",
        //   },
        // },
        { $sort: sortBy },
        { $skip: skip },
        { $limit: limit },
        { $project: getSelectData(select) },
      ])
      .exec(),
    product.countDocuments(productFilter),
  ]);

  return { products, count };
};

const findAllProductsForShop = async ({
  stock,
  sold,
  limit,
  page,
  filter,
  shop,
  sort,
  select,
}) => {
  const skip = limit * (page - 1);
  const sortBy = sort === "ctime" ? { _id: -1 } : { _id: 1 };
  const variationProjection = {
    keyVariation: 1,
    keyVariationValue: 1,
    subVariation: 1,
    subVariationValue: 1,
    price: 1,
    stock: 1,
    isSingle: 1,
    thumb: 1,
  };

  console.log("sold:: ", sold);
  console.log("stock:: ", stock);
  const productFilter = {
    ...filter,
    shop: convertToObjectIdMongodb(shop),
    sold: {
      $gte: sold?.min ? parseInt(sold?.min) : -1,
      $lte: sold?.max ? parseInt(sold?.max) : 10e9,
    },
    quantity: {
      $gte: stock?.min ? parseInt(stock?.min) : -1,
      $lte: stock?.max ? parseInt(stock?.max) : 10e9,
    },
  };
  const [products, count] = await Promise.all([
    product
      .aggregate([
        { $match: productFilter },
        {
          $lookup: {
            from: "variation",
            let: { variations: "$variations" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$_id", "$$variations"] },
                },
              },
              {
                $project: variationProjection,
              },
            ],
            as: "variations",
          },
        },
        { $sort: sortBy },
        { $skip: skip },
        { $limit: limit },
        { $project: getSelectData(select) },
      ])
      .exec(),
    product.countDocuments(productFilter),
  ]);

  return { products, count };
};

const findAllDraftForShop = async ({ query, limit, skip }) => {
  return await queryProduct({ query, limit, skip });
};

const findAllPublishForShop = async ({ query, limit, skip }) => {
  return await queryProduct({ query, limit, skip });
};

const searchProducts = async ({ keywords }) => {
  const regexSearch = new RegExp(keywords);
  const results = await product
    .find(
      {
        isPublished: true,
        $text: { $search: regexSearch },
      },
      { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" } })
    .lean()
    .exec();
  return results;
};

const updateProductById = async ({
  productId,
  payload,
  model,
  isNew = true,
}) => {
  return await model.findByIdAndUpdate(productId, payload, { new: isNew });
};

const publishProductByShop = async ({ shop, productId }) => {
  const foundProduct = await product
    .findOne({
      shop: new Types.ObjectId(shop),
      _id: new Types.ObjectId(productId),
    })
    .exec();

  if (!foundProduct) {
    return null;
  }

  foundProduct.isDraft = false;
  foundProduct.isPublished = true;
  console.log("foundProduct: ", foundProduct);

  const { modifiedCount } = await foundProduct.save();
  return modifiedCount;
};

const unpublishProductByShop = async ({ shop, productId }) => {
  const foundProduct = await product
    .findOne({
      shop: new Types.ObjectId(shop),
      _id: new Types.ObjectId(productId),
    })
    .exec();

  if (!foundProduct) {
    return null;
  }

  foundProduct.isDraft = true;
  foundProduct.isPublished = false;
  console.log("foundProduct: ", foundProduct);

  const { modifiedCount } = await foundProduct.save();
  return modifiedCount;
};

const getProductById = async (productId) => {
  return await product
    .findOne({ _id: convertToObjectIdMongodb(productId) })
    .lean()
    .exec();
};

// const checkProductByServer = async( products) => {
//   return await Promise.all( products.map( async product=> {
//     const foundProduct = await getProductById(product.productId)
//     if(foundProduct) {
//       return {
//         price: foundProduct.productPrice,
//         quantity: product.quantity,
//         productId: product.productId
//       }
//     }
//   }))
// }
//   return await product
//     .findOne({ _id: convertToObjectIdMongodb(productId) })
//     .lean()
//     .exec();
// };

const checkProductByServer = async (products) => {
  return await Promise.all(
    products.map(async (product) => {
      const foundProduct = await getProductById(product.productId);
      if (foundProduct) {
        return {
          price: foundProduct.price,
          quantity: product.quantity,
          productId: product.productId,
        };
      }
    })
  );
};

const addVariationToProduct = async ({ id, variation }) => {
  return await product
    .findOneAndUpdate(
      { _id: convertToObjectIdMongodb(id) },
      {
        $push: { variations: variation },
      }
    )
    .exec();
};

const updateStockProduct = async ({ id, quantity }) => {
  console.log("quantity: ", quantity);
  return await product
    .findOneAndUpdate(
      {
        _id: convertToObjectIdMongodb(id),
      },
      {
        $inc: { quantity: -quantity, sold: quantity },
      }
    )
    .exec();
};

module.exports = {
  findOneProduct,
  findAllProducts,
  findAllDraftForShop,
  findAllPublishForShop,
  publishProductByShop,
  unpublishProductByShop,
  searchProducts,
  updateProductById,
  getProductById,
  checkProductByServer,
  addVariationToProduct,
  findAllProductsForShop,
  findAllProductsForUser,
  updateStockProduct,
};
