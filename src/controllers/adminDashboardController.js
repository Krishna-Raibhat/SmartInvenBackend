import { prisma } from "../prisma/client.js";

const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error_code: code, message });

const success = (res, status, data) =>
  res.status(status).json({ success: true, ...data });

// GET /api/admin/dashboard
export const getDashboard = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      trialUsers,
      totalPayments,
      approvedPayments,
      pendingPayments,
      rejectedPayments,
      recentActivations,
      monthlyRevenue,
    ] = await Promise.all([
      // User counts
      prisma.owner.count(),
      prisma.owner.count({ where: { status: "active" } }),
      prisma.owner.count({ where: { status: "inactive" } }),
      prisma.owner.count({ where: { status: "trial" } }),

      // Payment counts
      prisma.paymentProof.count(),
      prisma.paymentProof.count({ where: { status: "approved" } }),
      prisma.paymentProof.count({ where: { status: "pending" } }),
      prisma.paymentProof.count({ where: { status: "rejected" } }),

      // Recent activations (last 10 approved payments)
      prisma.paymentProof.findMany({
        where: { status: "approved" },
        take: 10,
        orderBy: { reviewed_at: "desc" },
        include: {
          owner: {
            select: {
              owner_id: true,
              full_name: true,
              email: true,
              phone: true,
              status: true,
              subscription_expires_at: true,
            },
          },
        },
      }),

      // Monthly revenue (approved payments this month)
      prisma.paymentProof.count({
        where: {
          status: "approved",
          reviewed_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    // Calculate conversion rate
    const conversionRate = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0;

    const cards = [
      {
        title: "Total Users",
        value: totalUsers,
        icon: "users",
        color: "blue",
        description: "All registered users",
      },
      {
        title: "Active Users",
        value: activeUsers,
        icon: "user-check",
        color: "green",
        description: "Users with active subscription",
        percentage: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0,
      },
      {
        title: "Trial Users",
        value: trialUsers,
        icon: "clock",
        color: "orange",
        description: "Users in trial period",
        percentage: totalUsers > 0 ? ((trialUsers / totalUsers) * 100).toFixed(1) : 0,
      },
      {
        title: "Inactive Users",
        value: inactiveUsers,
        icon: "user-x",
        color: "red",
        description: "Awaiting payment verification",
        percentage: totalUsers > 0 ? ((inactiveUsers / totalUsers) * 100).toFixed(1) : 0,
      },
      {
        title: "Total Payments",
        value: totalPayments,
        icon: "credit-card",
        color: "purple",
        description: "All payment submissions",
      },
      {
        title: "Approved Payments",
        value: approvedPayments,
        icon: "check-circle",
        color: "green",
        description: "Verified payments",
        percentage: totalPayments > 0 ? ((approvedPayments / totalPayments) * 100).toFixed(1) : 0,
      },
      {
        title: "Pending Payments",
        value: pendingPayments,
        icon: "alert-circle",
        color: "yellow",
        description: "Awaiting review",
        percentage: totalPayments > 0 ? ((pendingPayments / totalPayments) * 100).toFixed(1) : 0,
      },
      {
        title: "Monthly Revenue",
        value: monthlyRevenue,
        icon: "trending-up",
        color: "indigo",
        description: "Approved payments this month",
      },
      {
        title: "Conversion Rate",
        value: `${conversionRate}%`,
        icon: "percent",
        color: "teal",
        description: "Trial to active conversion",
      },
    ];

    return success(res, 200, {
      cards,
      recent_activations: recentActivations,
      summary: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          trial: trialUsers,
        },
        payments: {
          total: totalPayments,
          approved: approvedPayments,
          pending: pendingPayments,
          rejected: rejectedPayments,
        },
        metrics: {
          conversion_rate: parseFloat(conversionRate),
          monthly_revenue: monthlyRevenue,
        },
      },
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/admin/dashboard/stats
export const getStats = async (req, res) => {
  try {
    const { period = "month" } = req.query; // month, week, year

    let startDate;
    const now = new Date();

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "month":
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const [newUsers, newPayments, newActivations] = await Promise.all([
      prisma.owner.count({
        where: { created_at: { gte: startDate } },
      }),
      prisma.paymentProof.count({
        where: { created_at: { gte: startDate } },
      }),
      prisma.paymentProof.count({
        where: {
          status: "approved",
          reviewed_at: { gte: startDate },
        },
      }),
    ]);

    return success(res, 200, {
      period,
      start_date: startDate,
      stats: {
        new_users: newUsers,
        new_payments: newPayments,
        new_activations: newActivations,
      },
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
