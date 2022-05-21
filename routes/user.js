const { response } = require("express");
var express = require("express");
const async = require("hbs/lib/async");
const { Db } = require("mongodb");
const { payment } = require("paypal-node-sdk");
var router = express.Router();
const productHelpers = require("../helpers/product-helpers");
const userHelpers = require("../helpers/user-hepers");
require('dotenv').config()
const serviceSsid = process.env.serviceSsid;
const AccountSsid = process.env.AccountSsid;
const token = process.env.token;
const client = require("twilio")(AccountSsid, token);
var paypal = require("paypal-rest-sdk");
const userHepers = require("../helpers/user-hepers");

paypal.configure({
  mode: "sandbox", //sandbox or live
  client_id:process.env. client_id,
  client_secret:process.env.client_secret,
});

const verifylogin = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
};

/* GET home page. */
router.get("/", async function (req, res, next) {
  let user = req.session.user;
  console.log(user);
  req.session.discount = 0;
  req.session.Wallet=0;
  cartCount = null;
  wishilistCount = null;
  var today = new Date();
  var dd = String(today.getDate()).padStart(2, "0");
  var mm = String(today.getMonth() + 1).padStart(2, "0"); //January is 0!
  var yyyy = today.getFullYear();
  today = yyyy + "-" + mm + "-" + dd;
  console.log("aaa", today);

  userHelpers.updatedatef(today).then((response) => {});
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }
  let trendingProducts=await productHelpers.gettrend()
  productHelpers.getAllBanner().then((banner) => {
    productHelpers.getAllofferproducts().then((products) => {
      productHelpers.getAllcategory().then((category) => {
        
        console.log(banner);

        res.render("user/view-products", {
          products,
          banner,
          user,
          category,
          cartCount, 
          userId: req.session.user?._id,
          wishilistCount,
          trendingProducts
        });
      });
    });
  }); 
});
router.get("/login", (req, res) => {
  if (req.session.loggedIn) {
    res.redirect("/");
  } else {
    console.log("hih");
    res.render("user/login", {loginErr: req.session.loginErr});
    req.session.loginErr = false;
  }
});
router.get("/signup", (req, res) => {
  let referel=req.query?.referel
console.log(referel);
  res.render("user/signup",{referel});
});

router.post("/signup", (req, res) => {
  let email = req.body.email; 
  let phone = req.body.phoneNumber;
 
  req.session.phoneNumber=phone 

  req.session.userDetails=req.body
  console.log();
  console.log(email);
  console.log(phone);
  userHelpers.emailCheck(email, phone).then((resolve) => {
    if (resolve) {
      if (resolve.phoneNumber == phone) {
        res.render("user/signup", { phone: true, phoneAll: "phone invaid" });
        phoneAll = false;
      } else {
        res.render("user/signup", { email: true });
        email = false;
      }
    } else {
      let phone =req.session.phoneNumber;
      client.verify
        .services(serviceSsid)
        .verifications.create({ to: `+91${phone}`, channel: "sms" })
        .then((resp) => {
          console.log(resp);
        });
      console.log("nmbmnvnb");
      res.render("user/singup-otp",{ phone });
      
    }
  });
});
router.post('/singupverify-otp',(req,res)=>{

  if (req.session.userDetails.referedCode) {
    req.session.userDetails.Wallet=100
    userHelpers.findrefferCode(req.body.referedCode).then(()=>{
      
    })
  }else{
    req.session.userDetails.Wallet=0
  }
  console.log(req.session.userDetails,"...........................................");

  console.log(req.body);
  let phone=req.session.phoneNumber
  let otp=req.body.phoneVerify
  console.log(otp);
  client.verify
  .services(serviceSsid)
  .verificationChecks.create({
    to: `+91${phone}`,
    code: otp,
  })
  .then((resp) => {
    console.log("otp res", resp);
    const user = resp.valid;

    if (user) {
      userHelpers.doSignup(req.session.userDetails).then((response) => {
        console.log(response);
        res.redirect("/login");
      });
     
    } else {
      console.log("failed");
      res.render("user/singup-otp", {phone,number:true});
      number = false;
    }
  });
});



router.post("/login", (req, res) => {
  userHelpers.doLogin(req.body).then((response) => {
    console.log(response.userBlock)
    if (response.userBlock) {
      res.render("user/login",{userBlock:true});
    } else {
      if(response.status) {
        req.session.loggedIn = true;
        req.session.user = response.user;
        console.log(req.session.user._id);
        res.redirect("/");
      } else {
        req.session.loginErr = true;
        res.redirect("/login");
      }
    }
  });
});
router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

//cart routes
router.get("/cart", verifylogin, async (req, res) => {
  let products = await userHelpers.getCartProducts(req.session.user?._id);
  let totalValue = await userHelpers.getTotalAmount(req.session.user?._id);
  req.session.total = totalValue - req.session.discount;
  console.log("ammen", req.session.total, totalValue, req.session.discount);
  console.log(req.session.user,"/////////////");
  if(req.session.Wallet>0){
    if(req.session.total==0){
      req.session.user.Wallet=req.session.Wallet
    }else{
    req.session.user.Wallet=0
    }
  }
  let total = req.session.total-req.session.Wallet
  cartCount = null;
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }
let Wallet=await userHepers.findWallet(req.session.user._id)

  if (cartCount==0) {
    res.render("user/cart-empty", {
      products,
      user: req.session.user,
      cartCount,
      total,
      wishilistCount
  
    });
  } else {
    res.render("user/cart", {
      products,
      user: req.session.user,
      cartCount,
      total,
      wishilistCount,
      Wallet
      
    });
  }
});
router.get("/add-to-cart/:id",verifylogin,(req, res) => {
  console.log(req.params.id);
  console.log("hi");
  console.log(req.session.user._id);
  userHelpers.addToCart(req.params.id,req.session.user._id).then(() => {
    res.json({ status:true});
  });
});

router.get("/view-image/:id", async (req, res) => {
  var imgId = req.params.id;
  let product = await userHelpers.imageDetails(imgId);

  let relProduct = product.category;
  let relatedProduct = await userHelpers.relatedDetails(relProduct);
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }
  res.render("user/view-image", {
    product,
    wishilistCount,
    cartCount,
    user: req.session.user,
    relatedProduct,
    userId: req.session.user?._id,
  });
});

//otp verfication

router.get("/verify-phone", (req, res) => {
  res.render("user/verify-phone");
});
router.post("/verify-phone", (req, res) => {
  let phone = req.body.phoneVerify;
  userHelpers.checkPhone(phone).then((number) => {
    // console.log(number);
    // console.log(number.userBlock)

    if (number) {
      if (number.userBlock) {
        res.render("user/verify-phone", { userBlock: true });
      } else {
        if (number) {
          let phone = number.phoneNumber;
          console.log(phone);
          client.verify
            .services(serviceSsid)
            .verifications.create({ to: `+91${phone}`, channel: "sms" })
            .then((resp) => {
              console.log(resp);
            });
          console.log("nmbmnvnb");
          res.render("user/verify-otp", { phone });
        } else {
          res.render("user/verify-phone", { number: true });
          number = false;
        }
      }
    } else {
      res.render("user/verify-phone", { number: true });
      number = false;
    }
  });
});

router.post("/verify-otp/:phone", (req, res) => {
  let phone = req.params.phone;
  let otp = req.body.phoneVerify;
  console.log(phone);

  client.verify
    .services(serviceSsid)
    .verificationChecks.create({
      to: `+91${phone}`,
      code: otp,
    })
    .then((resp) => {
      console.log("otp res", resp);
      const user = resp.valid;

      if (user) {
        userHelpers.doLoginOtp(phone).then((response) => {
          if (response) {
            console.log(response.name);
            req.session.loggedIn = true;
            req.session.user = response;
            res.redirect("/");
          } else {
            req.session.loginErr = true;
            res.redirect("/login");
          }
        });
        console.log("success");
        req.session.loggedIn = true;
        req.session.user = response.user;
      } else {
        console.log("failed");

        res.render("user/verify-otp", { phone, number: true });
        number = false;
      }
    });
});

router.get("/resent-otp/:phone", (req, res) => {
  let phone = req.params.phone;
  console.log("my" + phone);
  client.verify
    .services(serviceSsid)
    .verifications.create({ to: `+91${phone}`, channel: "sms" })
    .then((resp) => {
      console.log(resp);
    });
  res.render("user/verify-otp", { phone });
});

//category view
router.get("/category-view/:id", async (req, res) => {
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }
  let category = req.params.id;
  userHelpers.categoryView(category).then((products) => {
    console.log(products);
    res.render("user/view-category",{
      products,
      wishilistCount,
      cartCount,
      user: req.session?.user,
      userId: req.session.user?._id,
    });
  });
});

// quantity
router.post("/change-product-quantity", async (req, res, next) => {
  console.log(req.body);
    userHelpers.changeProductQuantity(req.body).then(async (response) => {
    let price = await userHelpers.getTotalAmount(req.body.user);
    req.session.total = price - req.session.discount;
    response.total = req.session.total;
    res.json(response);
  });
});
router.post("/remove-product-cart", (req, res) => {
  userHelpers.removeCartProduct(req.body).then((response) => {
    res.json(response);
  });
});

//product orders

router.get("/place-order", verifylogin, async (req, res) => {
  if(req.session.total==0){
   
    res.redirect('/')
  }else{
  let total = await userHelpers.getTotalAmount(req.session.user._id);
  req.session.total = total - req.session.discount-req.session.Wallet;
   

  let price = req.session.total;
  let discount = req.session.discount;
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }
  let userId = req.session.user._id;
  let user = req.session.user;
  let address = await userHelpers.getAddress(userId);
  console.log("kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk");
  console.log(address);
  let slectAddress = address[0];
  if (!slectAddress) {
    res.render("user/add-new-address", {
      price: req.session.total,
      cartCount,
      wishilistCount,
      userId,
      user,
      discount,
    });
  } else {
    res.render("user/Add-address", {
      price: req.session.total,
      user: req.session.user,
      cartCount,
      wishilistCount,
      address,
      discount,
    });
  }
}
});
router.post("/place-order", verifylogin, async (req, res) => {
  console.log("hoi",req.session.total);
  req.session.orders=req.body
  let totalPrice = await userHelpers.getTotalAmount(req.body.userId);

  let total = totalPrice-req.session.discount-req.session.Wallet;
  let userName = req.session.user.name;

      if (req.body["payment-method"] == "COD") {
        res.json({ codSuccess: true });
      } else if (req.body["payment-method"] == "ONLINE") {
        console.log("razorpay");
       
        userHelpers
          .generateRazorpay(req.session.user._id, req.session.total)
          .then((response) => {
            console.log("djjd" + response);
            res.json(response) ;
          });
      } else {
        console.log("entered to paypal");
        val = total / 74;
        totalPrice = val.toFixed(2);
        let totals = totalPrice.toString();
    
        var create_payment_json = {
          intent: "sale",
          payer: {
            payment_method: "paypal",
          },
          redirect_urls: {
            return_url: "http://localhost:3000/order-success",
            cancel_url: "http://localhost:3000/cancel",
          },
          transactions: [
            {
              item_list: {
                items: [
                  {
                    name: "item",
                    sku: "001",
                    price: totals,
                    currency: "USD",
                    quantity: 1,
                  },
                ],
              },
              amount: {
                currency: "USD",
                total: totals,
              },
              description: "This is the payment description.",
            },
          ],
        };
        paypal.payment.create(create_payment_json, function (error, payment) {
          if (error) {
            throw error;
          } else {
            console.log("Create Payment Response");
            console.log(payment);
            for (var i = 0; i < payment.links.length; i++) {
              console.log("1111");
              if (payment.links[i].rel === "approval_url") {
                console.log("2222");
                let link = payment.links[i].href;
                link = link.toString();
                res.json({ paypal: true, url: link });
              }
            }
          }
        });
      }
    
    })

  router.get("/order-success", verifylogin, async (req, res) => {
    if (req.session.total!=0) {
      
    
      console.log(req.session.orders);
      console.log();
    let address = await userHelpers.EditAddress(
      req.session.orders.userId,
      req.session.orders.checkoutAddress
    )
    let total=req.session.total
    let userName=req.session.user.name
    let deliveryAddress=address[0].Address;
    let products = await userHelpers.getCartProductList(req.session.orders.userId);
    console.log(products,"hp");
    userHelpers.placeOrder(deliveryAddress,products,total,userName,req.session.orders)
    .then((oderId) => {
      console.log(oderId);
      req.session.total=0
      req.session.discount = 0;
      req.session.Wallet = 0;

    })

   
    if (req.session.user) {
      var cartCount = await userHelpers.getCarCount(req.session.user._id);
      var wishilistCount = await userHelpers.getwishilistCount(
        req.session.user._id
      );
    }
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
    res.render("user/order-success", {
      user: req.session.user,
      cartCount,
      wishilistCount,
    });
  }else{
    res.redirect('/')
  }

  });

router.get("/orders", verifylogin, async (req, res) => {
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }
  console.log(req.session.user?._id);
  let orders = await userHelpers.getUserOrders(req.session.user?._id);
  console.log("sa",orders[0]);
  if(!orders[0]){
    res.render('user/order-empty',{
      user: req.session.user,
      cartCount,
      wishilistCount,
    })

}else{
  res.render("user/orders", {
    user: req.session.user,
    orders,
    cartCount,
    wishilistCount,
  });
}
});
router.get("/view-order-products/:id", verifylogin, async (req, res) => {
  console.log("Arshu",req.params.id);
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }
  let delivery= await userHelpers.orderstatus(req.params.id)
  let status=delivery.status
  if(status=='Delived'){
    var deleved=true
  }else{
  var deleved=false
  }
  let products = await userHelpers.getOrderProducts(req.params.id);
  console.log('asif',products);
  res.render("user/view-order-products", {
    user: req.session.user,
    products, 
    wishilistCount,
    cartCount,
    deleved
  });
});

// add wishilist

router.post("/add-wishilist", verifylogin, (req, res) => {
  console.log(req.body);
  let user = req.body.userId;
  let poroduct = req.body.proId;
  console.log("uhgfh");
  console.log(user);
  userHelpers.addWishilist(user, poroduct).then((response) => {
    console.log(response);
    res.json({ status: true });
  });
});
router.get("/wishilist-view", verifylogin, async (req, res) => {
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }

  console.log(req.session.user?._id);
  let wishilistItems = await userHelpers.getwishilistProducts(
    req.session.user?._id
  );
  console.log(wishilistItems);
  if (wishilistCount == 0) {
    res.render("user/wishilist-empty", {
      wishilistItems,
      userId: req.session.user?._id,
      user: req.session.user,
      cartCount,
      wishilistCount,
    });
  } else {
    res.render("user/wishilist", {
      wishilistItems,
      userId: req.session.user?._id,
      user: req.session.user,
      cartCount,
      wishilistCount,
    });
  }
});
router.post("/cancel-orders", verifylogin, (req, res) => {
  console.log("gjhghgfhj");
  let oderId = req.body.orderId;
  console.log(oderId);
  userHelpers.updateOrder(oderId).then((response) => {
    res.json({ status: true });
  });
});

router.post("/verify-payment", verifylogin, (req, res) => {
  let body = req.body;

  userHelpers
    .verifyPayment(req.body)
    .then(() => {
      console.log(body);
      userHelpers.changePymentStatus(req.body["order[receipt]"]).then(() => {
        console.log("suceess");
        res.json({ status: true });
      });
    })
    .catch((err) => {
      console.log(err);
      res.json({ status: "Payment failed" });
    });
});
router.get("/user-profile", verifylogin, async (req, res) => {
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }
  let userId = req.session.user._id;
  let address = await userHelpers.getAddress(userId);
  console.log("hjvhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh");
  console.log(req.session.user);
  let profile = address[0]?.profile;

  res.render("user/user-profile", {
    user: req.session.user,
    address,
    cartCount,
    wishilistCount,
  });
});
// router.get("/add-address", verifylogin, async (req, res) => {
//   if (req.session.user) {
//     var cartCount = await userHelpers.getCarCount(req.session.user._id);
//     var wishilistCount = await userHelpers.getwishilistCount(
//       req.session.user._id
//     );
//   }
//   let userId = req.session.user._id;
//   let user = req.session.user;
//   res.render("user/profile-address", {
//     userId: req.session.user._id,
//     wishilistCount,
//     cartCount,
//     user,
//   });
// });

router.post("/add-address", verifylogin, (req, res) => {
  console.log(req.body);
  let userId=req.session.user?._id
  userHelpers.addAddressprofile(req.body,userId).then((response) => {
    console.log(response);
  });
  res.redirect("/user-profile");
});
router.get("/edit-address/:id", async (req, res) => {
  let addressId = req.params.id;
  console.log(addressId);
  let userId = req.session.user?._id;
  let address = await userHelpers.EditAddress(userId, addressId);
  console.log("jjjjjjjjjjjjjjjjjjjjjjjjjj");
  res.render("user/edit-profile-address", { address });
});
router.post("/edit-address/:id", (req, res) => {
  let addressId = req.params.id;
  let userId = req.session.user._id;
  let data = req.body;
  console.log(addressId);
  console.log(req.body);
  console.log(userId);
  userHelpers.updateAddress(userId, addressId, data).then((resp) => {
    res.redirect("/user-profile");
  });
});
router.get("/delete-address/:id", (req, res) => {
  let addressId = req.params.id;
  let userID = req.session.user._id;
  userHelpers.deleteAddress(userID, addressId).then((resp) => {
    
    res.json(resp)
  });
});
router.post("/edit-profile/:id", (req, res) => {
  let userId = req.params.id;
  let user = req.body;
  console.log(userId);
  console.log(user);

  req.session.user.name = user.name;
  req.session.user.email = user.email;
  req.session.user.phoneNumber = user.phoneNumber;
  userHelpers.updateUser(userId, user).then((resp) => {
    res.redirect("/");
  });
});
router.get("/add-new-address", async (req, res) => {
  if(req.session.total==0){
    res.redirect('/')
  }else{
  
  let total = await userHelpers.getTotalAmount(req.session.user._id);
  let discount = req.session.discount;
  req.session.total = total - req.session.discount-req.session.Wallet;
  let price = req.session.total;
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }
  let userId = req.session.user._id;
  let user = req.session.user;
  res.render("user/add-new-address", {
    price,
    cartCount,
    wishilistCount,
    userId,
    user,
    discount,
  });
}

});
router.post("/add-new-address", async (req, res) => {
  
  userHelpers.addAddress(req.body).then((response) => {
    let addressId=response
  });
  console.log(req.body);
 

  let totalPrice = await userHelpers.getTotalAmount(req.body.userId);
  let total = totalPrice - req.session.discount-req.session.Wallet;
  req.session.total=total
  



  let userName = req.session.user.name;
  let address = await userHelpers.findUser(req.body.userId);
  let deliveryAddress = req.body;
 req.session.deliveryAddress=req.body;



  
      if (req.body["payment-method"] == "COD") {
        console.log("cod");
        res.json({ codSuccess: true });
      } else if (req.body["payment-method"] == "ONLINE") {
        console.log("razorpay");
     
    let totalPrice=req.session.total
        userHelpers.generateRazorpay(req.session.user._id, totalPrice).then((response) => {
          console.log("djjd" + response);
          res.json(response);
        });
      } else {
        console.log("paypal");
        val = total / 74;
        totalPrice = val.toFixed(2);
        let totals = totalPrice.toString();
        console.log(req.session.total);
        const create_payment_json = {
          intent: "sale",
          payer: {
            payment_method: "paypal",
          }, 
          redirect_urls: {
            return_url: "http://localhost:3000/order-successs",
            cancel_url: "http://localhost:3000/order-fialed",
          },
          transactions: [
            {
              item_list: {
                items: [
                  {
                    name: "MENS CART",
                    sku: "item",
                    price: totals,
                    currency: "USD",
                    quantity: 1,
                  },
                ],
              },
              amount: {
                currency: "USD",
                total: totals,
              },
              description: "This is the payment description.",
            },
          ], 
        };
        paypal.payment.create(create_payment_json, function (error, payment) {
          if (error) {
            throw error;
          } else {
            console.log(payment);
            for (let i = 0; i < payment.links.length; i++) {
              console.log("11");
              if (payment.links[i].rel === "approval_url") {
                let link=payment.links[i].href;
                link=link.toString();
                res.json({paypal:true,url:link})
              }
            }
          } 
        });
      }
    
    });
router.get("/order-successs", async (req, res) => {
  let products = await userHelpers.getCartProductList(req.session.deliveryAddress.userId);
    let deliveryAddress=req.session.deliveryAddress
    let totalPrice=req.session.total
    let userName=req.session.user.name
    console.log("sa",products,totalPrice);
  userHelpers.placeOrder(deliveryAddress, products, totalPrice, userName, req.session.deliveryAddress)
    .then((oderId) => {
      req.session.total=0 
      req.session.discount=0; 

    })
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }
  var wishilistCount = await userHelpers.getwishilistCount(
    req.session.user._id
  );
  res.render("user/order-success", {
    user: req.session.user,
    cartCount,
    wishilistCount,
  });
});
router.get("/asif", async (req, res) => {
  if (req.session.user) {
    var cartCount = await userHelpers.getCarCount(req.session.user._id);
    var wishilistCount = await userHelpers.getwishilistCount(
      req.session.user._id
    );
  }
  console.log(req.session.user?._id);
  let orders = await userHelpers.getUserOrders(req.session.user?._id);
  console.log(orders[0]?._id, "nhfngfghnfghf");

  let product = await userHelpers.getOrderProducts(orders[0]?._id);
  console.log("..", product);
  res.render("user/example", {
    user: req.session.user,
    orders,
    cartCount,
    wishilistCount,
    product,
  });
});
router.post("/edit-profilepic", (req, res) => {
  let user = req.session.user._id;
  console.log(user, "asif");
  if (req.files.image) {
    let image = req.files.image;
    image.mv("./public/profile-pic/" + user + ".jpg", (err, done) => {
      req.session.user.profile = true;
      userHelpers.updateprofile(user).then((response) => {
        res.redirect("/user-profile");
      });
    });
  }
});
router.get("/update-profilepic", (req, res) => {
  let userid = req.session.user._id;
  req.session.user.profile = false;
  userHelpers.updatepic(userid).then((response) => {
    res.json(response);
  });
});
router.post("/change-Phonenumber", (req, res) => {
  console.log("hi i");
  console.log(req.body);
  let phone = req.body.phonenumber;
  req.session.phoneNumber = phone;
  console.log(phone, "gh");
  client.verify
    .services(serviceSsid)
    .verifications.create({ to: `+91${phone}`, channel: "sms" })
    .then((resp) => {
      console.log(resp);
      res.render("user/verify-otpinprofile", { phone });
    });
});
router.post("/verify-otpprofile", (req, res) => {
  let phone = req.session.phoneNumber;
  let userid = req.session.user._id;
  console.log(userid);
  console.log(phone);
  let otp = req.body.phoneVerify;
  console.log(otp);

  client.verify
    .services(serviceSsid)
    .verificationChecks.create({
      to: `+91${phone}`,
      code: otp,
    })
    .then((resp) => {
      console.log("otp res", resp);
      var user = resp.valid;
      console.log(user);
      if (user == true) {
        req.session.user.phoneNumber = phone;
        console.log("asif");
        userHelpers.updatephone(phone, userid).then((response) => {
          res.redirect("/user-profile");
        });
      } else {
        console.log("ammen");
        res.render("user/verify-otpinprofile", { phone, number: true });
      }
    });
});
router.post("/applycoupon", async (req, res) => {
  let userId = req.session.user._id;
  let amount = req.session.total;
  let code = req.body.code;
  let coupon = await userHelpers.checkcoupon(code);
  if (coupon) {
    console.log(coupon);
    let check = await userHelpers.checkuser(userId, code);
    if (check) {
      res.json({ user: true });
    } else {
      userHelpers.updatcoupon(userId, code).then((response) => {
        let discountVal = ((amount * coupon.discount) / 100).toFixed();
        req.session.discount = discountVal;
        let offerprice = amount - discountVal;
        req.session.total = offerprice;
        console.log(offerprice);
        res.json({ offerprice });
      });
    }
  } else {
    res.json(response);
  }
});
router.post("/change-Password", (req, res) => {
  let userID = req.session.user._id;
  console.log(req.body);
  console.log(userID);
  userHelpers.checkPassword(userID, req.body).then((response) => {
    console.log(response);
    res.json(response);
  });
});
router.get('/updateWallet',(req,res)=>{
  console.log(req.session.user.Wallet);
  if(req.session.user.Wallet<req.session.total){
    req.session.total=req.session.total-req.session.user.Wallet
    req.session.Wallet=req.session.user.Wallet
    userHelpers.updateWallet(req.session.user._id).then((resp)=>{
      console.log("response",req.session.user.Wallet);
      req.session.user.Wallet=0 
     console.log("response",req.session.user.Wallet);

    })
    res.json({total:req.session.total,Wallet:0})
    console.log(req.session.total);
  }else{
     console.log("hghkjhkj");
     console.log(req.session.total);
    req.session.Wallet=req.session.user.Wallet-req.session.total
    req.session.total=0
    console.log(req.session.Wallet);
    req.session.user.Wallet=req.session.Wallet
    userHelpers.updateWallett(req.session.user._id,req.session.user.Wallet).then((resp)=>{

    })
    res.json({totall:req.session.total,Wallett:req.session.Wallet})   
  }
})

module.exports = router;
